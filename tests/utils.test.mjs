import { test } from 'node:test';
import assert from 'node:assert/strict';

import config from '../server/src/config/index.js';
import {
  getAzureEndpoints,
  isAllowedEmail,
  isTenantId,
  pinToOrigin,
} from '../server/src/utils/azure.js';
import { getCookieSettings, getRefreshExpiry } from '../server/src/utils/session-cookies.js';

const TENANT = '72F988BF-86F1-41AF-91AB-2D7CD011DB47';

const validConfig = (overrides = {}) => ({
  ...config.default,
  tenantId: TENANT,
  clientId: 'client-id',
  clientSecret: 'secret',
  callbackUrl: 'https://cms.example.com/azure-sso/callback',
  ...overrides,
});

test('isTenantId accepts only a tenant GUID', () => {
  assert.equal(isTenantId(TENANT), true);
  assert.equal(isTenantId('common'), false);
  assert.equal(isTenantId('contoso.onmicrosoft.com'), false);
  assert.equal(isTenantId(null), false);
});

test('getAzureEndpoints builds v2.0 endpoints from the tenant and authority host', () => {
  const tenant = TENANT.toLowerCase();
  assert.deepEqual(getAzureEndpoints({ tenantId: TENANT }), {
    origin: 'https://login.microsoftonline.com',
    issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
    discoveryUrl: `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  });
  assert.equal(
    getAzureEndpoints({ tenantId: TENANT, authorityHost: 'https://login.microsoftonline.us/' }).origin,
    'https://login.microsoftonline.us'
  );
});

test('pinToOrigin keeps same-origin https URLs and rejects anything else', () => {
  const origin = 'https://login.microsoftonline.com';
  assert.equal(
    pinToOrigin(`${origin}/t/oauth2/v2.0/authorize?x=1`, 'authorization_endpoint', origin),
    `${origin}/t/oauth2/v2.0/authorize?x=1`
  );
  assert.throws(() => pinToOrigin('https://evil.example.com/keys', 'jwks_uri', origin), /not on/);
  assert.throws(() => pinToOrigin('http://login.microsoftonline.com/keys', 'jwks_uri', origin), /not on/);
  assert.throws(() => pinToOrigin('not a url', 'jwks_uri', origin), /not a valid URL/);
});

test('isAllowedEmail matches the domain exactly and case-insensitively', () => {
  assert.equal(isAllowedEmail('a@Example.com', null), true);
  assert.equal(isAllowedEmail('a@example.com', ['EXAMPLE.com']), true);
  assert.equal(isAllowedEmail('a@sub.example.com', ['example.com']), false);
  assert.equal(isAllowedEmail('a@example.com.evil.io', ['example.com']), false);
});

test('config validator accepts a complete config', () => {
  assert.doesNotThrow(() => config.validator(validConfig()));
  assert.doesNotThrow(() =>
    config.validator(validConfig({ defaultRole: 'Editor', allowedEmailDomains: ['example.com'] }))
  );
});

test('config validator rejects missing or invalid values', () => {
  assert.throws(() => config.validator({ ...config.default }), /"tenantId" is required/);
  assert.throws(() => config.validator(validConfig({ tenantId: 'common' })), /tenant\) ID GUID/);
  assert.throws(() => config.validator(validConfig({ callbackUrl: '/azure-sso/callback' })), /callbackUrl/);
  assert.throws(() => config.validator(validConfig({ authorityHost: 'http://x' })), /authorityHost/);
  assert.throws(() => config.validator(validConfig({ scope: 'email profile' })), /openid/);
  assert.throws(() => config.validator(validConfig({ allowedEmailDomains: 'example.com' })), /allowedEmailDomains/);
  assert.throws(
    () => config.validator(validConfig({ emailLoginEnabled: false, ssoLoginEnabled: false })),
    /cannot both be false/
  );
});

test('getCookieSettings follows the admin.auth.cookie settings', () => {
  const defaults = getCookieSettings(() => undefined, { isProduction: true, secureRequest: true });
  assert.equal(defaults.accessCookieName, 'jwtToken');
  assert.equal(defaults.refresh.path, '/admin');
  assert.equal(defaults.refresh.secure, true);
  assert.equal(defaults.refresh.sameSite, 'lax');
  assert.equal(defaults.access.path, '/');
  assert.equal(defaults.access.httpOnly, false);

  assert.equal(getCookieSettings(() => undefined, { isProduction: false, secureRequest: true }).refresh.secure, false);

  const custom = {
    'admin.auth.cookie.name': 'cmsToken',
    'admin.auth.cookie.path': '/cms',
    'admin.auth.cookie.domain': 'example.com',
    'admin.auth.cookie.secure': true,
    'admin.auth.sessions.idleRefreshTokenLifespan': 60,
  };
  const settings = getCookieSettings((key) => custom[key], { isProduction: false, secureRequest: false });
  assert.equal(settings.accessCookieName, 'cmsToken');
  assert.equal(settings.refresh.path, '/cms');
  assert.equal(settings.refresh.domain, 'example.com');
  assert.equal(settings.access.domain, 'example.com');
  assert.equal(settings.refresh.secure, true);
  assert.equal(settings.idleSeconds, 60);
});

test('getRefreshExpiry uses the earlier of the idle and absolute expiry', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(getRefreshExpiry(60, null, now).getTime(), now + 60_000);
  assert.equal(getRefreshExpiry(3600, '2026-01-01T00:10:00Z', now).toISOString(), '2026-01-01T00:10:00.000Z');
});
