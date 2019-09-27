const path = require('path');
const inquirer = require('inquirer');
const builder = require('./builder');
const constants = require('./constants');

const hostingPlugin = 'amplify-category-hosting';

async function run(context) {
  const hostingPluginModule = require(context.amplify.getPlugin(context, hostingPlugin));
  const enabledServices = await hostingPluginModule.getEnabledServices(context);
  let selectedHostingService;

  if (enabledServices.length > 0) {
    if (enabledServices.length === 1) {
      selectedHostingService = enabledServices[0].value;
    } else {
      const serviceQuestion = await inquirer.prompt({
        type: 'list',
        name: 'selectedService',
        message: 'Please select the service to publish to.',
        choices: enabledServices,
        default: enabledServices[0],
      });
      selectedHostingService = serviceQuestion.selectedService;
    }

    // No build and run required for CI/CD

    if (await checkForCICD(context, selectedHostingService)) {
      return publishToHostingBucket(context, selectedHostingService);
    }
  } else {
    throw new Error('No hosting service enabled. Please run \'amplify add hosting\'.');
  }

  return builder.run(context)
    .then(() => publishToHostingBucket(context, selectedHostingService))
    .then(onSuccess)
    .catch(onFailure);
}

function checkForCICD(context, selectedHostingService) {
  const amplifyMeta = context.amplify.getProjectMeta();
  if (selectedHostingService === 'AmplifyConsole'
    && amplifyMeta.hosting
    && amplifyMeta.hosting.AmplifyConsole
    && amplifyMeta.hosting.AmplifyConsole.deployType === 'CICD') {
    return true;
  }

  return false;
}

function publishToHostingBucket(context, selectedHostingService) {
  const { projectConfig } = context.exeInfo;
  const { projectPath } = context.amplify.getEnvInfo();
  const distributionDirName = projectConfig[constants.Label].config.DistributionDir;
  const distributionDirPath = path.join(projectPath, distributionDirName);
  const hostingPluginModule = require(context.amplify.getPlugin(context, hostingPlugin));


  return hostingPluginModule.publish(context, selectedHostingService, { distributionDirPath });
}

function onSuccess() {
}

function onFailure(e) {
  throw e;
}

module.exports = {
  run,
};
