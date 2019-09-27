const path = require('path');
const sequential = require('promise-sequential');
const constants = require('./constants');
const supportedServices = require('./supported-services');
const addAmplifyHosting = require('amplify-hosting-service').add;
const publishAmplifyHosting = require('amplify-hosting-service').publish;
const configureAmplifyHosting = require('amplify-hosting-service').configure;
const consoleAmplifyHosting = require('amplify-hosting-service').console;

const category = 'hosting';

function getAvailableServices(context) {
  const availableServices = [];
  const projectConfig = context.amplify.getProjectConfig();

  Object.keys(supportedServices).forEach((service) => {
    if (projectConfig.providers.includes(supportedServices[service].provider) ||
        supportedServices[service].provider === 'NONE') {
      availableServices.push({ name: supportedServices[service].description, value: service });
    }
  });

  return availableServices;
}

function getCategoryStatus(context) {
  const enabledServices = [];
  let disabledServices = [];

  const availableServices = getAvailableServices(context);
  if (availableServices.length > 0) {
    const amplifyMeta = context.amplify.getProjectMeta();
    if (amplifyMeta.hosting) {
      const servicesAdded = Object.keys(amplifyMeta.hosting);
      availableServices.forEach((availableService) => {
        if (servicesAdded.includes(availableService.value)) {
          enabledServices.push(availableService);
        } else {
          disabledServices.push(availableService);
        }
      });
    } else {
      disabledServices = availableServices;
    }
  }

  return {
    availableServices,
    enabledServices,
    disabledServices,
  };
}

function runServiceAction(context, service, action, args) {
  if (service !== null && typeof service === 'object') {
    service = service.value;
  }

  context.exeInfo = context.amplify.getProjectDetails();
  if (context.exeInfo.amplifyMeta) {
    context.exeInfo.categoryMeta = context.exeInfo.amplifyMeta[constants.CategoryName];
    if (context.exeInfo.categoryMeta) {
      context.exeInfo.serviceMeta = context.exeInfo.categoryMeta[service];
    }
  }

  if (service === 'AmplifyConsole') {
    switch (action) {
      case 'enable': return addAmplifyHosting(context);
      case 'publish': return publishAmplifyHosting(context);
      case 'configure': return configureAmplifyHosting(context);
      case 'console': return consoleAmplifyHosting(context);
      default: context.print.error('Action not supported');
    }
  } else {
    const serviceModule = require(path.join(__dirname, `${service}/index.js`));
    return serviceModule[action](context, args);
  }
}

async function migrate(context) {
  const migrationTasks = [];
  const { migrationInfo } = context;
  const categoryMeta = migrationInfo.amplifyMeta[constants.CategoryName];
  if (categoryMeta) {
    Object.keys(categoryMeta).forEach((service) => {
      const serviceModule = require(path.join(__dirname, `${service}/index.js`));
      migrationTasks.push(() => serviceModule.migrate(context));
    });
  }
  await sequential(migrationTasks);
}


function getIAMPolicies(resourceName, crudOptions) {
  let policy = {};
  let actions = new Set();

  crudOptions.forEach((crudOption) => {
    switch (crudOption) {
      case 'create': actions.add('s3:PutObject');
        break;
      case 'update': actions.add('s3:PutObject');
        break;
      case 'read': actions.add('s3:GetObject'); actions.add('s3:ListBucket');
        break;
      case 'delete': actions.add('s3:DeleteObject');
        break;
      default: console.log(`${crudOption} not supported`);
    }
  });

  actions = Array.from(actions);
  policy = {
    Effect: 'Allow',
    Action: actions,
    Resource: [
      {
        'Fn::Join': [
          '',
          [
            'arn:aws:s3:::',
            {
              Ref: `${category}${resourceName}HostingBucketName`,
            },
            '/*',
          ],
        ],
      },
    ],
  };

  const attributes = ['HostingBucketName'];

  return { policy, attributes };
}


module.exports = {
  getCategoryStatus,
  runServiceAction,
  migrate,
  getIAMPolicies,
};
