import { DEFAULT_AUTHORITY_HOST, isTenantId } from '../utils/azure.js';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

const isUrl = (value, protocols) => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export default {
  default: {
    tenantId: null,
    clientId: null,
    clientSecret: null,
    // e.g. https://cms.example.com/azure-sso/callback, registered as a redirect URI in Azure.
    callbackUrl: null,
    // Only needed for national clouds, e.g. https://login.microsoftonline.us
    authorityHost: DEFAULT_AUTHORITY_HOST,
    scope: 'openid email profile',
    // Name of the admin role given to people who log in without an admin account.
    // When null, only existing admin users can log in with Azure.
    defaultRole: null,
    // null means any domain. Arrays default to null rather than [] because Strapi merges
    // plugin config with defaultsDeep, which would merge arrays index by index.
    allowedEmailDomains: null,
    emailLoginEnabled: true,
    ssoLoginEnabled: true,
    buttonLabel: 'Log in with Azure',
  },
  validator(config) {
    for (const key of ['tenantId', 'clientId', 'clientSecret', 'callbackUrl']) {
      if (!isNonEmptyString(config[key])) {
        throw new Error(`azure-sso plugin: "${key}" is required`);
      }
    }
    if (!isTenantId(config.tenantId)) {
      throw new Error(
        'azure-sso plugin: "tenantId" must be the Directory (tenant) ID GUID from Azure, not a domain or "common"'
      );
    }
    if (!isUrl(config.callbackUrl, ['https:', 'http:'])) {
      throw new Error('azure-sso plugin: "callbackUrl" must be an absolute URL');
    }
    if (!isUrl(config.authorityHost, ['https:'])) {
      throw new Error('azure-sso plugin: "authorityHost" must be an https URL');
    }
    if (!isNonEmptyString(config.scope) || !config.scope.split(/\s+/).includes('openid')) {
      throw new Error('azure-sso plugin: "scope" must include "openid"');
    }
    if (config.defaultRole != null && !isNonEmptyString(config.defaultRole)) {
      throw new Error('azure-sso plugin: "defaultRole" must be a role name or null');
    }
    if (
      config.allowedEmailDomains != null &&
      !(Array.isArray(config.allowedEmailDomains) && config.allowedEmailDomains.every(isNonEmptyString))
    ) {
      throw new Error('azure-sso plugin: "allowedEmailDomains" must be an array of domain names or null');
    }
    for (const key of ['emailLoginEnabled', 'ssoLoginEnabled']) {
      if (typeof config[key] !== 'boolean') {
        throw new Error(`azure-sso plugin: "${key}" must be a boolean`);
      }
    }
    if (!config.emailLoginEnabled && !config.ssoLoginEnabled) {
      throw new Error('azure-sso plugin: "emailLoginEnabled" and "ssoLoginEnabled" cannot both be false');
    }
    if (!isNonEmptyString(config.buttonLabel)) {
      throw new Error('azure-sso plugin: "buttonLabel" must be a non-empty string');
    }
  },
};
