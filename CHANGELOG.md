# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-27

### Added

- Log in to the Strapi 5 admin panel with Azure AD (Microsoft Entra ID) using OpenID Connect.
- "Log in with Azure" button on the login page, with a message when sign-in fails.
- Real Strapi admin sessions (refresh and access tokens), so renewal and logout work as usual.
- Optional account creation with `defaultRole` and an `allowedEmailDomains` allow-list.
- `emailLoginEnabled: false` hides the email form and blocks password login on the server.
- `admin.auth.success` and `admin.auth.autoRegistration` events with `provider: 'azure'`.
