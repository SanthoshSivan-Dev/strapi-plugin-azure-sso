import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PLUGIN_ID } from '../pluginId';
import { getAzureEndpoints, pinToOrigin } from '../utils/azure';

const oidcService = ({ strapi }) => {
  let discovery = null;
  let jwks = null;
  let loading = null;

  const getConfig = () => strapi.config.get(`plugin::${PLUGIN_ID}`);

  const fetchDiscovery = async () => {
    const config = getConfig();
    const { origin, issuer, discoveryUrl, tokenEndpoint } = getAzureEndpoints(config);

    const res = await fetch(discoveryUrl);
    if (!res.ok) {
      throw new Error(`failed to fetch the OpenID configuration from ${discoveryUrl} (HTTP ${res.status})`);
    }
    const doc = await res.json();

    // OIDC Discovery 1.0 §4.3: the document's issuer must be the one we asked for.
    if (doc.issuer !== issuer) {
      throw new Error(`discovery issuer "${doc.issuer}" does not match "${issuer}"`);
    }
    // The client secret is only ever posted to the endpoint built from the tenant ID;
    // the discovery value just has to agree with it.
    if (doc.token_endpoint !== tokenEndpoint) {
      throw new Error(`discovery token_endpoint "${doc.token_endpoint}" does not match "${tokenEndpoint}"`);
    }

    const pinned = {
      issuer,
      tokenEndpoint,
      authorizationEndpoint: pinToOrigin(doc.authorization_endpoint, 'authorization_endpoint', origin),
      jwksUri: pinToOrigin(doc.jwks_uri, 'jwks_uri', origin),
    };

    jwks = createRemoteJWKSet(new URL(pinned.jwksUri));
    discovery = pinned;
    return pinned;
  };

  return {
    getConfig,

    // Loaded lazily and retried on the next login if it failed, so an Azure outage at
    // boot doesn't stop Strapi (and email login) from starting.
    async getDiscovery() {
      if (discovery) return discovery;
      if (!loading) {
        loading = fetchDiscovery().finally(() => {
          loading = null;
        });
      }
      return loading;
    },

    async exchangeCode(code) {
      const config = getConfig();
      const { tokenEndpoint } = await this.getDiscovery();

      const res = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.callbackUrl,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: config.scope,
        }),
      });
      if (!res.ok) {
        throw new Error(`token endpoint responded with HTTP ${res.status}`);
      }
      return res.json();
    },

    async verifyIdToken(idToken, expectedNonce) {
      const config = getConfig();
      const { issuer } = await this.getDiscovery();

      const { payload } = await jwtVerify(idToken, jwks, {
        issuer,
        audience: config.clientId,
        algorithms: ['RS256'],
      });

      if (payload.nonce !== expectedNonce) {
        throw new Error('nonce mismatch');
      }
      if (typeof payload.tid === 'string' && payload.tid.toLowerCase() !== config.tenantId.toLowerCase()) {
        throw new Error('tenant mismatch');
      }

      return payload;
    },
  };
};

export default oidcService;
