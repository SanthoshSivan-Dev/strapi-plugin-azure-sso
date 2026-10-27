import crypto from 'node:crypto';
import { REFRESH_COOKIE_NAME, getCookieSettings, getRefreshExpiry } from '../utils/session-cookies';

const sessionService = ({ strapi }) => ({
  // Logs the user in the same way Strapi's own login does: a session row with an
  // httpOnly refresh cookie, plus an access token the admin panel picks up on load.
  async createAdminSession(ctx, user, deviceId = crypto.randomUUID()) {
    if (!strapi.sessionManager) {
      throw new Error('Strapi session manager is not available (Strapi 5.24.2 or later is required)');
    }

    const settings = getCookieSettings((key) => strapi.config.get(key), {
      isProduction: process.env.NODE_ENV === 'production',
      secureRequest: ctx.request.secure,
    });

    const sessions = strapi.sessionManager('admin');
    const { token: refreshToken, absoluteExpiresAt } = await sessions.generateRefreshToken(
      String(user.id),
      deviceId,
      { type: 'refresh', metadata: { loginAt: new Date().toISOString() } }
    );

    const accessResult = await sessions.generateAccessToken(refreshToken);
    if ('error' in accessResult) {
      throw new Error(`could not create an access token (${accessResult.error})`);
    }

    const expires = getRefreshExpiry(settings.idleSeconds, absoluteExpiresAt);
    ctx.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
      ...settings.refresh,
      expires,
      maxAge: Math.max(0, expires.getTime() - Date.now()),
    });
    ctx.cookies.set(settings.accessCookieName, accessResult.token, settings.access);
  },
});

export default sessionService;
