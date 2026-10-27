import crypto from 'node:crypto';
import { PLUGIN_ID } from '../pluginId';
import { getEmailDomain, isAllowedEmail } from '../utils/azure';

const STATE_COOKIE = 'azure_sso_state';
const STATE_TTL_MS = 5 * 60 * 1000;
const PROVIDER = 'azure';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getAdminUrl = () => (strapi.config.get('admin.url') || '/admin').replace(/\/$/, '');

const stateCookieOptions = (ctx) => ({
  httpOnly: true,
  signed: true,
  secure: ctx.request.secure,
  sameSite: 'lax',
  path: `/${PLUGIN_ID}`,
});

const getService = (name) => strapi.plugin(PLUGIN_ID).service(name);

const authController = {
  async connect(ctx) {
    const oidc = getService('oidc');
    const config = oidc.getConfig();
    if (!config.ssoLoginEnabled) return ctx.notFound();

    let authorizationEndpoint;
    try {
      ({ authorizationEndpoint } = await oidc.getDiscovery());
    } catch (err) {
      strapi.log.error(`${PLUGIN_ID}: ${err.message}`);
      return ctx.redirect(`${getAdminUrl()}/auth/login?error=sso`);
    }

    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    // The login page sends the admin panel's device ID so that logging out revokes
    // this session. Anything that isn't a UUID is replaced with a new one.
    const { deviceId: requestedDeviceId } = ctx.query;
    const deviceId =
      typeof requestedDeviceId === 'string' && UUID.test(requestedDeviceId) ? requestedDeviceId : crypto.randomUUID();

    ctx.cookies.set(STATE_COOKIE, JSON.stringify({ state, nonce, deviceId }), {
      ...stateCookieOptions(ctx),
      maxAge: STATE_TTL_MS,
    });

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.callbackUrl);
    authUrl.searchParams.set('scope', config.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);

    ctx.redirect(authUrl.toString());
  },

  async callback(ctx) {
    const oidc = getService('oidc');
    const config = oidc.getConfig();
    if (!config.ssoLoginEnabled) return ctx.notFound();

    const fail = (reason) => {
      strapi.log.warn(`${PLUGIN_ID}: login failed (${reason})`);
      ctx.redirect(`${getAdminUrl()}/auth/login?error=sso`);
    };

    const rawState = ctx.cookies.get(STATE_COOKIE, { signed: true });
    ctx.cookies.set(STATE_COOKIE, null, stateCookieOptions(ctx));
    if (!rawState) return fail('missing or tampered state cookie');

    let savedState;
    try {
      savedState = JSON.parse(rawState);
    } catch {
      return fail('malformed state cookie');
    }

    const { code, state, error } = ctx.query;
    if (error) return fail(`Azure returned error: ${error}`);
    if (typeof code !== 'string' || typeof state !== 'string' || state !== savedState.state) {
      return fail('state mismatch');
    }

    let claims;
    try {
      const tokenResponse = await oidc.exchangeCode(code);
      claims = await oidc.verifyIdToken(tokenResponse.id_token, savedState.nonce);
    } catch (err) {
      strapi.log.error(`${PLUGIN_ID}: ${err.message}`);
      return fail('token exchange or id_token verification failed');
    }

    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (!email.includes('@')) {
      return fail('id_token has no email claim; add the "email" optional claim in Azure');
    }
    if (!isAllowedEmail(email, config.allowedEmailDomains)) {
      return fail(`email domain "${getEmailDomain(email)}" is not in allowedEmailDomains`);
    }

    const userService = strapi.service('admin::user');
    let user = await userService.findOneByEmail(email);

    if (!user) {
      if (!config.defaultRole) return fail(`no admin user for ${email} and no defaultRole set`);

      const role = await strapi.service('admin::role').findOne({ name: config.defaultRole });
      if (!role) return fail(`defaultRole "${config.defaultRole}" does not exist`);

      user = await userService.create({
        email,
        firstname: claims.given_name || claims.name || email.split('@')[0],
        lastname: claims.family_name || '',
        roles: [role.id],
        isActive: true,
        registrationToken: null,
      });

      strapi.eventHub.emit('admin.auth.autoRegistration', {
        user: userService.sanitizeUser(user),
        provider: PROVIDER,
      });
    }

    if (!user.isActive || user.blocked) return fail(`admin user ${email} is not active`);

    try {
      await getService('session').createAdminSession(ctx, user, savedState.deviceId);
    } catch (err) {
      strapi.log.error(`${PLUGIN_ID}: ${err.message}`);
      return fail('could not create an admin session');
    }

    strapi.eventHub.emit('admin.auth.success', {
      user: userService.sanitizeUser(user),
      provider: PROVIDER,
    });

    ctx.redirect(getAdminUrl());
  },

  // Read by the login page; the browser can't see config/plugins.js.
  async loginOptions(ctx) {
    const { emailLoginEnabled, ssoLoginEnabled, buttonLabel } = getService('oidc').getConfig();
    ctx.body = { emailLoginEnabled, ssoLoginEnabled, buttonLabel };
  },
};

export default authController;
