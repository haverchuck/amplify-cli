const { getProjectConfig } = require('./get-project-config');
const { getResourceStatus } = require('./resource-status');
const { getProviderPlugins } = require('./get-provider-plugins');
const showAmplifyHostingLinks = require('amplify-hosting-service').status;

async function showHelpfulProviderLinks(context) {
  const { providers } = getProjectConfig();
  const providerPlugins = getProviderPlugins(context);
  const providerPromises = [];

  const {
    allResources,
  } = await getResourceStatus();

  // Show Amplify Console URLs
  try {
    if (allResources.findIndex(resource => resource.category === 'hosting' && resource.service === 'AmplifyConsole') !== -1) {
      await showAmplifyHostingLinks(context);
    }
  } catch (e) {
    console.log(e.stack);
  }

  providers.forEach((providerName) => {
    const pluginModule = require(providerPlugins[providerName]);
    providerPromises.push(pluginModule.showHelpfulLinks(context, allResources));
  });

  return Promise.all(providerPromises);
}

module.exports = {
  showHelpfulProviderLinks,
};
