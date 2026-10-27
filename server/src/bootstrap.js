import { PLUGIN_ID } from './pluginId';

const bootstrap = async ({ strapi }) => {
  const oidc = strapi.plugin(PLUGIN_ID).service('oidc');
  const config = oidc.getConfig();

  if (!strapi.sessionManager) {
    strapi.log.error(`${PLUGIN_ID}: Strapi 5.24.2 or later is required; Azure login will not work`);
  }
  if (!config.ssoLoginEnabled) return;

  try {
    await oidc.getDiscovery();
    strapi.log.info(`${PLUGIN_ID}: ready for tenant ${config.tenantId}`);
  } catch (err) {
    strapi.log.error(`${PLUGIN_ID}: ${err.message}; will retry on the next Azure login`);
  }
};

export default bootstrap;
