import { PLUGIN_ID } from './pluginId';

// With emailLoginEnabled: false the login form is hidden, and these endpoints are
// closed too, so a password can't be used even by calling the API directly.
// /admin/register-admin stays open: it only works while no admin exists yet.
const EMAIL_LOGIN_ROUTES = new Set(['/admin/login', '/admin/forgot-password', '/admin/reset-password']);

const register = ({ strapi }) => {
  const config = strapi.config.get(`plugin::${PLUGIN_ID}`);
  if (config.emailLoginEnabled) return;

  strapi.server.use(async (ctx, next) => {
    if (ctx.method === 'POST' && EMAIL_LOGIN_ROUTES.has(ctx.path)) {
      ctx.status = 403;
      ctx.body = {
        data: null,
        error: { status: 403, name: 'ForbiddenError', message: 'Email login is disabled. Log in with Azure.' },
      };
      return;
    }
    await next();
  });
};

export default register;
