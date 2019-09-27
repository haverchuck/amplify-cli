const inquirer = require('inquirer');
const categoryManager = require('./lib/category-manager');

const category = 'hosting';

async function add(context) {
  const {
    availableServices,
    enabledServices,
  } = categoryManager.getCategoryStatus(context);

  if (availableServices.length > 0) {
    const answers = await inquirer.prompt({
      type: 'list',
      name: 'selectedService',
      message: 'Please select the service to add.',
      choices: availableServices,
      default: availableServices[0],
    });
    const { selectedService } = answers;

    if (enabledServices.findIndex(service => service.value === selectedService) !== -1) {
      context.print.error(`Hosting is already enabled for ${selectedService}`);
      return;
    }
    return categoryManager.runServiceAction(context, selectedService, 'enable');
  }
  const errorMessage = 'Hosting is not available from enabled providers.';
  context.print.error(errorMessage);
  throw new Error(errorMessage);
}

async function configure(context) {
  const {
    availableServices,
    enabledServices,
  } = categoryManager.getCategoryStatus(context);

  if (availableServices.length > 0) {
    if (enabledServices.length > 1) {
      const serviceSelection = await inquirer.prompt({
        type: 'list',
        name: 'selectedService',
        message: 'Please select the service to configure.',
        choices: enabledServices,
        default: enabledServices[0],
      });

      const service = serviceSelection.selectedService;
      return categoryManager.runServiceAction(context, service, 'configure');
    } else if (enabledServices.length === 1) {
      return categoryManager.runServiceAction(context, enabledServices[0], 'configure');
    }
    throw new Error('No hosting service is enabled.');
  } else {
    throw new Error('Hosting is not available from enabled providers.');
  }
}

async function publish(context, selectedHostingService, args) {
  if (selectedHostingService) {
    return categoryManager.runServiceAction(context, selectedHostingService, 'publish', args);
  }
  throw new Error('No hosting service is enabled.');
}

async function console(context) {
  const {
    availableServices,
    enabledServices,
  } = categoryManager.getCategoryStatus(context);

  if (availableServices.length > 0) {
    if (enabledServices.length > 1) {
      const answer = await inquirer.prompt({
        type: 'list',
        name: 'selectedService',
        message: 'Please select the service.',
        choices: enabledServices,
        default: enabledServices[0],
      });
      return categoryManager.runServiceAction(context, answer.selectedService, 'console');
    } else if (enabledServices.length === 1) {
      return categoryManager.runServiceAction(context, enabledServices[0], 'console');
    }
    throw new Error('No hosting service is enabled.');
  } else {
    throw new Error('Hosting is not available from enabled providers.');
  }
}

async function migrate(context) {
  await categoryManager.migrate(context);
}

async function getPermissionPolicies(context, resourceOpsMapping) {
  const permissionPolicies = [];
  const resourceAttributes = [];

  Object.keys(resourceOpsMapping).forEach((resourceName) => {
    const { policy, attributes } = categoryManager.getIAMPolicies(
      resourceName,
      resourceOpsMapping[resourceName],
    );
    permissionPolicies.push(policy);
    resourceAttributes.push({ resourceName, attributes, category });
  });
  return { permissionPolicies, resourceAttributes };
}

async function getEnabledServices(context) {
  const {
    enabledServices,
  } = categoryManager.getCategoryStatus(context);

  return enabledServices;
}


module.exports = {
  add,
  configure,
  publish,
  console,
  migrate,
  getPermissionPolicies,
  getEnabledServices,
};
