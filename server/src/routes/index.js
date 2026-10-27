// Admin routes are served at /azure-sso/*, so the Azure redirect URI is
// https://<your-strapi-host>/azure-sso/callback
export default {
  'admin-api': {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/connect',
        handler: 'auth.connect',
        config: { auth: false },
      },
      {
        method: 'GET',
        path: '/callback',
        handler: 'auth.callback',
        config: { auth: false },
      },
      {
        method: 'GET',
        path: '/login-options',
        handler: 'auth.loginOptions',
        config: { auth: false },
      },
    ],
  },
};
