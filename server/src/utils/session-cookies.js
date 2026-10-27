// Mirrors how Strapi's own admin login (5.24+) sets its session cookies, reading the
// same admin.auth.cookie.* settings, so the admin panel can refresh and clear them.

export const REFRESH_COOKIE_NAME = 'strapi_admin_refresh';
export const DEFAULT_ACCESS_COOKIE_NAME = 'jwtToken';
const DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN = 14 * 24 * 60 * 60;

export const getCookieSettings = (getConfig, { isProduction, secureRequest }) => {
  const configuredSecure = getConfig('admin.auth.cookie.secure');
  const secure = typeof configuredSecure === 'boolean' ? configuredSecure : isProduction && secureRequest;
  const domain = getConfig('admin.auth.cookie.domain') || getConfig('admin.auth.domain') || undefined;

  return {
    accessCookieName: getConfig('admin.auth.cookie.name') || DEFAULT_ACCESS_COOKIE_NAME,
    idleSeconds: Number(
      getConfig('admin.auth.sessions.idleRefreshTokenLifespan') ?? DEFAULT_IDLE_REFRESH_TOKEN_LIFESPAN
    ),
    refresh: {
      httpOnly: true,
      secure,
      overwrite: true,
      domain,
      path: getConfig('admin.auth.cookie.path') || '/admin',
      sameSite: getConfig('admin.auth.cookie.sameSite') ?? 'lax',
    },
    // The admin panel reads the access token from this cookie when it starts. Path=/
    // is used because Strapi versions differ in the path they write it to, and every
    // version from 5.24 reads it there and clears it on logout. It is unsigned, like the
    // cookie the admin panel writes itself, so no .sig cookie is left behind on logout.
    access: {
      httpOnly: false,
      signed: false,
      secure,
      overwrite: true,
      domain,
      path: '/',
      sameSite: 'lax',
    },
  };
};

export const getRefreshExpiry = (idleSeconds, absoluteExpiresAt, now = Date.now()) => {
  const idleExpiry = now + idleSeconds * 1000;
  const absoluteExpiry = absoluteExpiresAt ? new Date(absoluteExpiresAt).getTime() : idleExpiry;
  return new Date(Math.min(idleExpiry, absoluteExpiry));
};
