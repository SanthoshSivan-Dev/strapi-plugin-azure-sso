export const DEFAULT_AUTHORITY_HOST = 'https://login.microsoftonline.com';

const TENANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a single tenant's GUID is accepted. Azure's discovery document reports the
// GUID as its issuer even when it's requested by domain name, and the multi-tenant
// endpoints (common, organizations, consumers) have no single issuer to check the
// id_token against.
export const isTenantId = (value) => typeof value === 'string' && TENANT_ID.test(value);

export const getAzureEndpoints = ({ tenantId, authorityHost }) => {
  const { origin } = new URL(authorityHost || DEFAULT_AUTHORITY_HOST);
  const base = `${origin}/${tenantId.toLowerCase()}`;

  return {
    origin,
    issuer: `${base}/v2.0`,
    discoveryUrl: `${base}/v2.0/.well-known/openid-configuration`,
    tokenEndpoint: `${base}/oauth2/v2.0/token`,
  };
};

// The discovery document is fetched over the network, so its endpoint URLs are not
// trusted as-is. Each one must be https on the authority's origin, and is rebuilt on
// that origin so the server only ever calls the identity provider it was set up for.
export const pinToOrigin = (value, field, origin) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`discovery ${field} is not a valid URL`);
  }
  if (url.protocol !== 'https:' || url.origin !== origin) {
    throw new Error(`discovery ${field} is not on ${origin}`);
  }
  return new URL(`${url.pathname}${url.search}`, origin).toString();
};

export const getEmailDomain = (email) => email.slice(email.lastIndexOf('@') + 1).toLowerCase();

export const isAllowedEmail = (email, allowedDomains) => {
  if (!allowedDomains?.length) return true;
  const domain = getEmailDomain(email);
  return allowedDomains.some((allowed) => allowed.toLowerCase() === domain);
};
