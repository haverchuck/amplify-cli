const inquirer = require('inquirer');
const chalk = require('chalk');
const chalkpipe = require('chalk-pipe');
const {
  readdirSync,
  statSync,
  readFileSync,
  unlinkSync,
} = require('fs');
const { copySync } = require('fs-extra');
const { flattenDeep, uniq } = require('lodash');
const { join } = require('path');

/**
 * @function triggerFlow
 * @param {object} context CLI context
 * @param {string} resource The provider (i.e. cognito)
 * @param {string} category The CLI category (i.e. amplify-category-auth)
 * @param {object} previousTriggers Object representing already configured triggers
 *  @example {"PostConfirmation":["add-to-group"]}
 * @returns {object} Object with current key/value pairs for triggers and templates
 */

const triggerFlow = async (context, resource, category, previousTriggers = {}) => {
  // handle missing params
  if (!resource) throw new Error('No resource provided to trigger question flow');
  if (!category) throw new Error('No category provided to trigger question flow');

  // make sure resource is capitalized
  const resourceName = `${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;

  // ask user if they want to manually configure triggers
  const wantTriggers = await inquirer.prompt({
    name: 'confirmation',
    type: 'confirm',
    message: `Do you want to configure Lambda Triggers for ${resourceName}?`,
  });

  // if user does not want to manually configure triggers, return null
  if (!wantTriggers.confirmation) {
    return null;
  }

  // path to trigger directory in category
  const triggerPath = `${__dirname}/../../../../${category}/provider-utils/awscloudformation/triggers/`;

  // get available triggers
  const triggerOptions = choicesFromMetadata(triggerPath, resource, true);

  // instantiate trigger question
  const triggerQuestion = {
    name: 'triggers',
    type: 'checkbox',
    message: `Which triggers do you want to enable for ${resourceName}`,
    choices: triggerOptions,
    default: Object.keys(previousTriggers),
  };

  // get trigger metadata
  const triggerMeta = getTriggerMetadata(triggerPath, resource);

  // ask triggers question via learn more loop
  const askTriggers = await learnMoreLoop('triggers', resourceName, triggerMeta, triggerQuestion);

  // instantiate triggerObj
  const triggerObj = {};

  // loop through triggers that user selected,
  // and ask which templates they want using template metadata and learn more loop
  for (let i = 0; i < askTriggers.triggers.length; i++) {
    const optionsPath = `${__dirname}/../../../../${category}/provider-utils/awscloudformation/triggers/${askTriggers.triggers[i]}`;

    const templateOptions = choicesFromMetadata(optionsPath, askTriggers.triggers[i]);
    templateOptions.push({ name: 'Create your own module', value: 'custom' });
    const templateMeta = getTriggerMetadata(optionsPath, askTriggers.triggers[i]);
    const readableTrigger = triggerMeta[askTriggers.triggers[i]].name;

    const templateQuestion = {
      name: 'templates',
      type: 'checkbox',
      message: `What functionality do you want to use for ${readableTrigger}`,
      choices: templateOptions,
      default: flattenDeep(previousTriggers[askTriggers.triggers[i]]),
    };
    const askTemplates = await learnMoreLoop('templates', readableTrigger, templateMeta, templateQuestion);
    triggerObj[`${askTriggers.triggers[i]}`] = askTemplates.templates;
  }

  const tempTriggerObj = Object.assign({}, triggerObj);
  Object.values(tempTriggerObj).forEach((t, index) => {
    if (!t || t.length < 1) {
      delete triggerObj[Object.keys(triggerObj)[index]];
    }
  }, { triggerObj });
  return triggerObj;
};

/**
 * @function getTriggerPermissions
 * @param {object} context CLI context
 * @param {string} triggers Serialized trigger object
 * @param {string} category The CLI category (i.e. amplify-category-auth)
 * @returns {array} Array of serialized permissions objects
 * @example ["{
 *    "policyName": "AddToGroup",
 *    "trigger": "PostConfirmation",
 *    "actions": ["cognito-idp:AdminAddUserToGroup"],
 *    "resources": [
 *      {
 *        "type": "UserPool",
 *        "attribute": "Arn"
 *      }
 *    ]
 *  }"]
 */
const getTriggerPermissions = (context, triggers, category) => {
  let permissions = [];
  const parsedTriggers = JSON.parse(triggers);
  const triggerKeys = Object.keys(parsedTriggers);
  triggerKeys.forEach((k) => {
    const meta = context.amplify.getTriggerMetadata(
      `${__dirname}/../../../../${category}/provider-utils/awscloudformation/triggers/${k}`,
      k,
    );
    // parsedTriggers[k].forEach((t) => {
    if (meta[parsedTriggers[k]] && meta[parsedTriggers[k]].permissions) {
      permissions = permissions.concat(meta[parsedTriggers[k]].permissions);
    }
    // });
  });
  permissions = permissions.map(i => JSON.stringify(i));
  return permissions;
};


const learnMoreLoop = async (key, map, metaData, question) => {
  let selections = await inquirer.prompt(question);

  while (
    // handle answers that are strings or arrays
    (Array.isArray(selections[key]) && selections[key].includes('learn'))
  ) {
    let prefix;
    if (metaData.URL) {
      prefix = `\nAdditional information about the ${key} available for ${map} can be found here: ${chalkpipe(null, chalk.blue.underline)(metaData.URL)}\n`;
      prefix = prefix.concat('\n');
    } else {
      prefix = `\nThe following ${key} are available in ${map}\n`;
      Object.values(metaData).forEach((m) => {
        prefix = prefix.concat('\n');
        prefix = prefix.concat(`${chalkpipe(null, chalk.green)('\nName:')} ${m.name}${chalkpipe(null, chalk.green)('\nDescription:')} ${m.description}\n`);
        prefix = prefix.concat('\n');
      });
    }
    question.prefix = prefix;
    selections = await inquirer.prompt(question);
  }
  return selections;
};

const choicesFromMetadata = (path, selection, isDir) => {
  const templates = isDir ?
    readdirSync(path)
      .filter(f => statSync(join(path, f)).isDirectory()) :
    readdirSync(path).map(t => t.substring(0, t.length - 3));

  const metaData = getTriggerMetadata(path, selection);
  const configuredOptions = Object.keys(metaData).filter(k => templates.includes(k));
  const options = configuredOptions.map(c => ({ name: `${metaData[c].name}`, value: c }));
  // add learn more w/ seperator
  options.unshift(new inquirer.Separator());
  options.unshift({ name: 'Learn More', value: 'learn' });
  return options;
};

const getTriggerMetadata = (path, selection) => JSON.parse(readFileSync(`${path}/${selection}.map.json`));

async function openEditor(context, path, name) {
  const filePath = `${path}/${name}.js`;
  if (await context.amplify.confirmPrompt.run(`Do you want to edit your ${name} function now?`)) {
    await context.amplify.openEditor(context, filePath);
  }
}

const addTrigger = async (
  key,
  values,
  context,
  resourceName,
  triggerEnvs,
  category,
  parentStack,
  targetPath,
) => {
  let add;
  try {
    ({ add } = require('amplify-category-function'));
  } catch (e) {
    throw new Error('Function plugin not installed in the CLI. You need to install it to use this feature.');
  }

  await add(context, 'awscloudformation', 'Lambda', {
    modules: values,
    parentResource: resourceName,
    resourceName,
    functionName: resourceName,
    parentStack,
    triggerEnvs: JSON.stringify(triggerEnvs[key]),
    roleName: resourceName,
  });
  context.print.success('Succesfully added the Lambda function locally');
  for (let v = 0; v < values.length; v += 1) {
    await copyFunctions(key, values[v], category, context, targetPath);
  }

  const result = {};
  result[key] = resourceName;
  return result;
};

const updateTrigger = async (
  key,
  values,
  context,
  resourceName,
  triggerEnvs,
  category,
  parentStack,
  targetPath,
) => {
  const updatedTrigger = {};
  let update;
  try {
    ({ update } = require('amplify-category-function'));
  } catch (e) {
    throw new Error('Function plugin not installed in the CLI. You need to install it to use this feature.');
  }
  try {
    await update(context, 'awscloudformation', 'Lambda', {
      modules: values,
      parentResource: resourceName,
      resourceName,
      functionName: resourceName,
      parentStack,
      triggerEnvs: JSON.stringify(triggerEnvs[key]),
      roleName: resourceName,
    });
    context.print.success('Succesfully added the Lambda function locally');
    for (let v = 0; v < values.length; v += 1) {
      await copyFunctions(key, values[v], category, context, targetPath);
      context.amplify.updateamplifyMetaAfterResourceAdd(
        'function',
        resourceName,
        {
          build: true,
          dependsOn: undefined,
          providerPlugin: 'awscloudformation',
          service: 'Lambda',
        },
      );
    }

    await cleanFunctions(key, values, category, context, targetPath);

    return updatedTrigger;
  } catch (e) {
    throw new Error('Unable to update lambda function');
  }
};

const deleteDeselectedTriggers = async (
  currentTriggers,
  previousTriggers,
  resourceName,
  targetDir,
  context,
) => {
  const currentKeys = Object.keys(currentTriggers);
  const previousKeys = Object.keys(previousTriggers);
  // const newKeyValues = Object.assign(currentTriggers);

  for (let p = 0; p < previousKeys.length; p += 1) {
    if (!currentKeys.includes(previousKeys[p])) {
      const functionName = `${resourceName}${previousKeys[p]}`;
      const targetPath = `${targetDir}/function/${functionName}`;
      await context.amplify.deleteTrigger(context, functionName, targetPath);
    }
  }
};

const deleteTrigger = async (context, name, dir) => {
  try {
    await context.amplify.forceRemoveResource(context, 'function', name, dir);
  } catch (e) {
    throw new Error('Function plugin not installed in the CLI. You need to install it to use this feature.');
  }
};

const deleteAllTriggers = async (triggers, resourceName, dir, context) => {
  const previousKeys = Object.keys(triggers);
  for (let y = 0; y < previousKeys.length; y += 1) {
    const functionName = `${resourceName}${previousKeys[y]}`;
    const targetPath = `${dir}/function/${functionName}`;
    await deleteTrigger(context, functionName, targetPath);
  }
};

const copyFunctions = async (key, value, category, context, targetPath) => {
  const dirContents = readdirSync(targetPath);
  if (!dirContents.includes(`${value}.js`)) {
    let source = '';
    if (value === 'custom') {
      source = `${__dirname}/../../../../amplify-category-function/provider-utils/awscloudformation/function-template-dir/trigger-custom.js`;
    } else {
      source = `${__dirname}/../../../../${category}/provider-utils/awscloudformation/triggers/${key}/${value}.js`;
    }
    copySync(source, `${targetPath}/${value}.js`);
    await openEditor(context, targetPath, value);
  }
};

const cleanFunctions = async (key, values, category, context, targetPath) => {
  const meta = context.amplify.getTriggerMetadata(
    `${__dirname}/../../../../${category}/provider-utils/awscloudformation/triggers/${key}`,
    key,
  );
  const dirContents = readdirSync(targetPath);
  for (let x = 0; x < dirContents.length; x += 1) {
    if (dirContents[x] !== 'custom.js') {
      if (meta[`${dirContents[x]}.js`] && !values.includes(dirContents[x])) {
        try {
          unlinkSync(`${targetPath}/${dirContents[x]}`);
        } catch (e) {
          throw new Error('Failed to delete module');
        }
      }
    }
    if (dirContents[x] === 'custom.js' && !values.includes('custom')) {
      try {
        unlinkSync(`${targetPath}/${dirContents[x]}`);
      } catch (e) {
        throw new Error('Failed to delete module');
      }
    }
  }
  return null;
};

/**
 * @function
 * @param {array} triggers Currently selected triggers in CLI flow array of key/values
 * @example ["{"TriggerName2":["template2"]}"]
 * @param {string} previous Serialized object of previously selected trigger values
 * @example "{\"TriggerName1\":[\"template1\"]}"
 * @return {object} Object with current and previous triggers, with concatenated values for unions
 */
const parseTriggerSelections = (triggers, previous) => {
  const triggerObj = {};
  const previousTriggers = previous && previous.length > 0 ? JSON.parse(previous) : null;
  for (let i = 0; i < triggers.length; i += 1) {
    if (typeof triggers[i] === 'string') {
      triggers[i] = JSON.parse(triggers[i]);
    }
    const currentTrigger = Object.keys(triggers[i])[0];
    const currentValue = Object.values(triggers[i])[0];
    if (!triggerObj[currentTrigger]) {
      triggerObj[currentTrigger] = currentValue;
    } else {
      triggerObj[currentTrigger] = uniq(triggerObj[currentTrigger]
        .concat(currentValue));
    }
    if (previousTriggers && previousTriggers[currentTrigger]) {
      triggerObj[currentTrigger] = uniq(triggerObj[currentTrigger]
        .concat(previousTriggers[currentTrigger]));
    }
  }
  return triggerObj;
};

const getTriggerEnvVariables = (context, trigger, category) => {
  let env = [];
  const meta = context.amplify.getTriggerMetadata(
    `${__dirname}/../../../../${category}/provider-utils/awscloudformation/triggers/${trigger.key}`,
    trigger.key,
  );
  if (trigger.modules) {
    for (let x = 0; x < trigger.modules.length; x++) {
      if (meta[trigger.modules[x]] && meta[trigger.modules[x]].env) {
        env = env.concat(meta[trigger.modules[x]].env);
      }
    }
    return env;
  }

  return null;
};

const dependsOnBlock = (context, triggerKeys = [], provider) => {
  if (!context) throw new Error('No context provided to dependsOnBlock');
  if (!provider) throw new Error('No provider provided to dependsOnBlock');
  const dependsOnArray = context.updatingAuth && context.updatingAuth.dependsOn ?
    context.updatingAuth.dependsOn :
    [];
  triggerKeys.forEach((l) => {
    if (!dependsOnArray.find(a => a.resourceName === l)) {
      dependsOnArray.push({
        category: 'function',
        resourceName: l,
        triggerProvider: provider,
        attributes: ['Arn', 'Name'],
      });
    }
  });
  dependsOnArray.forEach((x, index) => {
    if (x.triggerProvider === provider && !triggerKeys.includes(x.resourceName)) {
      dependsOnArray.splice(dependsOnArray[index], 1);
    }
  });
  return dependsOnArray;
};

module.exports = {
  triggerFlow,
  addTrigger,
  updateTrigger,
  deleteTrigger,
  deleteAllTriggers,
  deleteDeselectedTriggers,
  dependsOnBlock,
  parseTriggerSelections,
  getTriggerMetadata,
  getTriggerPermissions,
  getTriggerEnvVariables,
};