<p align="center">
  <img src="https://raw.githubusercontent.com/SanthoshSivan-Dev/strapi-plugin-azure-sso/main/assets/logo.png" alt="Azure SSO logo" width="120" height="120">
</p>

# strapi-plugin-azure-sso

[![npm version](https://img.shields.io/npm/v/strapi-plugin-azure-sso.svg)](https://www.npmjs.com/package/strapi-plugin-azure-sso)
[![license](https://img.shields.io/npm/l/strapi-plugin-azure-sso.svg)](https://github.com/SanthoshSivan-Dev/strapi-plugin-azure-sso/blob/main/LICENSE)

Log in to the **Strapi 5** admin panel with **Azure AD (Microsoft Entra ID)**, on the free
Community Edition.

Strapi's built-in SSO requires a paid plan. This plugin adds a **Log in with Azure** button
to the admin login page and signs people in with OpenID Connect. Optionally, it creates admin
accounts on first login and turns off email and password login.

> This is an independent community plugin. It is not affiliated with, endorsed by or
> supported by Strapi Solutions SAS or Microsoft.

## Features

- **Log in with Azure** button on the admin login page, with an error message when sign-in fails.
- Real Strapi admin sessions: the same refresh and access tokens as a normal login, so
  session renewal, logout and the session limits in `config/admin.js` work as usual.
- Optional automatic account creation with a default role (`defaultRole`).
- Optional allow-list of email domains (`allowedEmailDomains`).
- Optional email login switch-off (`emailLoginEnabled: false`). It hides the form and also
  closes the login, forgot-password and reset-password endpoints.
- Emits `admin.auth.success` with `provider: 'azure'`, so audit plugins such as
  [strapi-plugin-audit-logging](https://www.npmjs.com/package/strapi-plugin-audit-logging)
  record Azure logins.

**Security checks**

- Authorization code flow with `state` (in a signed, httpOnly cookie) and `nonce`.
- The ID token is verified against Azure's signing keys: signature (RS256), issuer, audience,
  expiry, nonce and tenant.
- The client secret is only ever sent to the token endpoint built from your tenant ID.
- The discovery document must match your tenant, and every URL in it must be on the Azure
  login host.
- Deactivated or blocked admin users can't log in.

## Requirements

- Strapi `5.24.2` or later (5.24 added admin sessions; 5.24.0 and 5.24.1 are deprecated on npm)
- Node.js 20 or later
- An Azure AD (Microsoft Entra ID) tenant

## 1. Set up the app in Azure

1. In the Azure portal, open **Microsoft Entra ID → App registrations → New registration**.
   - **Supported account types:** *Accounts in this organizational directory only* (single tenant).
   - **Redirect URI:** platform **Web**, URL `https://<your-strapi-host>/azure-sso/callback`.
     For local development you can add `http://localhost:1337/azure-sso/callback`.
2. From the app's **Overview** page, copy the **Application (client) ID** and the
   **Directory (tenant) ID**.
3. Under **Certificates & secrets → New client secret**, create a secret and copy its **Value**.
4. Under **Token configuration → Add optional claim**, choose token type **ID** and tick
   **email**. Accept the prompt to add the Microsoft Graph `email` permission.
   Without this claim the ID token has no email address and login fails.

## 2. Install

```bash
npm install strapi-plugin-azure-sso
# or
yarn add strapi-plugin-azure-sso
# or
pnpm add strapi-plugin-azure-sso
```

## 3. Configure

Add the plugin to `config/plugins.js` (or `config/plugins.ts`):

```js
module.exports = ({ env }) => ({
  'azure-sso': {
    enabled: true,
    config: {
      tenantId: env('AZURE_SSO_TENANT_ID'),
      clientId: env('AZURE_SSO_CLIENT_ID'),
      clientSecret: env('AZURE_SSO_CLIENT_SECRET'),
      callbackUrl: env('AZURE_SSO_CALLBACK_URL'),
    },
  },
});
```

And to `.env`:

```bash
AZURE_SSO_TENANT_ID=00000000-0000-0000-0000-000000000000
AZURE_SSO_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_SSO_CLIENT_SECRET=your-client-secret
AZURE_SSO_CALLBACK_URL=https://cms.example.com/azure-sso/callback
```

Then rebuild the admin panel and restart Strapi:

```bash
npm run build
npm run start
```

Open the admin login page and click **Log in with Azure**. By default only people who already
have a Strapi admin account with the same email address can log in. Set `defaultRole` to let
anyone in your tenant in.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `tenantId` | required | Directory (tenant) ID. It must be the GUID; domain names and `common` aren't accepted. |
| `clientId` | required | Application (client) ID. |
| `clientSecret` | required | Client secret value. |
| `callbackUrl` | required | The redirect URI registered in Azure: `https://<host>/azure-sso/callback`. |
| `defaultRole` | `null` | Name of the admin role (for example `'Editor'`) given to people who log in without an admin account. When `null`, only existing admin users can log in. |
| `allowedEmailDomains` | `null` | For example `['example.com']`. Only these email domains can log in. `null` allows any domain in your tenant. |
| `emailLoginEnabled` | `true` | Set to `false` to hide the email and password form and block password login. |
| `ssoLoginEnabled` | `true` | Set to `false` to hide the Azure button and close the Azure routes. |
| `buttonLabel` | `'Log in with Azure'` | Text on the login button. |
| `scope` | `'openid email profile'` | OpenID Connect scopes. It must include `openid`. |
| `authorityHost` | `'https://login.microsoftonline.com'` | Only change this for national clouds, for example `https://login.microsoftonline.us`. |

### Turning off email login

With `emailLoginEnabled: false`:

- The login form and the "Forgot your password?" link are hidden.
- `POST /admin/login`, `/admin/forgot-password` and `/admin/reset-password` return `403`.
- `/admin/register-admin` stays open, so you can still create the first admin on a new
  project. It only works while no admin exists.

If Azure is unavailable, set `emailLoginEnabled` back to `true` and restart Strapi to log in
with a password.

### Behind a proxy

If Strapi runs behind a reverse proxy or load balancer that terminates HTTPS, set
`proxy: true` in `config/server.js`. Strapi then knows the request was secure and sets
`Secure` cookies. Cookie settings under `admin.auth.cookie` in `config/admin.js` (name, path,
domain, sameSite, secure) are respected.

## How it works

1. **Log in with Azure** opens `/azure-sso/connect`, which redirects to Azure with a random
   `state` and `nonce`.
2. Azure redirects back to `/azure-sso/callback`. The plugin checks `state`, exchanges the code
   for tokens, and verifies the ID token.
3. The plugin finds the admin user by email, or creates one when `defaultRole` is set.
4. It creates a Strapi admin session, the same as Strapi's own login does, and redirects to
   the admin panel, which opens already logged in.

## Limitations

- **Single tenant only.** Multi-tenant apps (`common`, `organizations`) aren't supported.
- **Users are matched by the `email` claim.** Keep `allowedEmailDomains` set to domains your
  tenant owns, and don't invite guest users whose email domain you don't control.
- **Roles aren't synced from Azure groups.** New users get `defaultRole`, and you can change
  their roles in Strapi afterwards.

## Development

```bash
git clone https://github.com/SanthoshSivan-Dev/strapi-plugin-azure-sso.git
cd strapi-plugin-azure-sso
npm install
npm test        # needs Node 22 or later
npm run build
```

To try your changes in a Strapi app, run `npm run watch:link` here and follow the
instructions it prints, or run `npm pack` and install the generated `.tgz` file in your app.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run build` before
opening a pull request.

## License

[MIT](https://github.com/SanthoshSivan-Dev/strapi-plugin-azure-sso/blob/main/LICENSE)

Strapi is a trademark of Strapi Solutions SAS. Microsoft, Azure and Microsoft Entra are
trademarks of the Microsoft group of companies. This project is not affiliated with either.
