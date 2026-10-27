import { PLUGIN_ID } from './pluginId';

// Strapi Community Edition has no hook into the login page, so the "Log in with
// Azure" button is added to the rendered page and kept there with a MutationObserver.

const BUTTON_ID = `${PLUGIN_ID}-login`;
const HIDE_EMAIL_LOGIN_STYLE_ID = `${PLUGIN_ID}-hide-email-login`;

// Azure logomark path data (Simple Icons, CC0). The fill follows the text color.
const AZURE_LOGO_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M22.379 23.343a1.62 1.62 0 0 0 1.536-2.14v.002L17.35 1.76A1.62 1.62 0 0 0 15.816.657H8.184A1.62 1.62 0 0 0 6.65 1.76L.086 21.204a1.62 1.62 0 0 0 1.536 2.139h4.741a1.62 1.62 0 0 0 1.535-1.103l.977-2.892 4.947 3.675c.28.208.618.32.966.32m-3.084-12.531 3.624 10.739a.54.54 0 0 1-.51.713v-.001h-.03a.54.54 0 0 1-.322-.106l-9.287-6.9h4.853m6.313 7.006c.116-.326.13-.694.007-1.058L9.79 1.76a1.722 1.722 0 0 0-.007-.02h6.034a.54.54 0 0 1 .512.366l6.562 19.445a.54.54 0 0 1-.338.684"/></svg>';

const getBackendUrl = () => (window.strapi?.backendURL || '').replace(/\/$/, '');

// The admin panel identifies the browser by this ID when it logs out. Sending it along
// means the Azure session is created under it and logging out revokes it.
const DEVICE_ID_KEY = 'strapi.admin.deviceId';

const getOrCreateDeviceId = () => {
  try {
    let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId && typeof crypto?.randomUUID === 'function') {
      deviceId = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return null;
  }
};

const getConnectUrl = () => {
  const url = new URL(`${getBackendUrl()}/${PLUGIN_ID}/connect`, window.location.origin);
  const deviceId = getOrCreateDeviceId();
  if (deviceId) url.searchParams.set('deviceId', deviceId);
  return url.toString();
};

const isLoginPage = () => /\/auth\/login\/?$/.test(window.location.pathname);

const findLoginForm = () => document.querySelector('form input[name="email"]')?.closest('form') ?? null;

// If the plugin's route can't be reached, the page is left as Strapi renders it.
const fetchLoginOptions = () =>
  fetch(`${getBackendUrl()}/${PLUGIN_ID}/login-options`, { credentials: 'same-origin' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch(() => null);

const createButton = ({ buttonLabel, emailLoginEnabled }) => {
  const wrapper = document.createElement('div');
  wrapper.id = BUTTON_ID;
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding-top:16px;';

  if (emailLoginEnabled) {
    const divider = document.createElement('p');
    divider.textContent = 'or';
    divider.style.cssText =
      'margin:0;text-align:center;font-size:1.2rem;font-weight:600;text-transform:uppercase;color:#8e8ea9;';
    wrapper.appendChild(divider);
  }

  if (new URLSearchParams(window.location.search).get('error') === 'sso') {
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.textContent = 'Azure sign-in failed. Please try again or contact an administrator.';
    error.style.cssText = 'margin:0;text-align:center;font-size:1.4rem;color:#d02b20;';
    wrapper.appendChild(error);
  }

  const link = document.createElement('a');
  link.href = getConnectUrl();
  link.innerHTML = AZURE_LOGO_SVG;
  const label = document.createElement('span');
  label.textContent = buttonLabel;
  link.appendChild(label);
  link.style.cssText =
    'display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-radius:4px;' +
    'background:#0078d4;color:#fff;font-weight:600;font-size:1.4rem;line-height:2rem;text-decoration:none;';
  link.addEventListener('mouseenter', () => (link.style.background = '#006cbe'));
  link.addEventListener('mouseleave', () => (link.style.background = '#0078d4'));
  wrapper.appendChild(link);

  return wrapper;
};

const setEmailLoginHidden = (hidden) => {
  const style = document.getElementById(HIDE_EMAIL_LOGIN_STYLE_ID);
  if (!hidden) {
    style?.remove();
    return;
  }
  if (style) return;

  const el = document.createElement('style');
  el.id = HIDE_EMAIL_LOGIN_STYLE_ID;
  el.textContent = `form[data-${PLUGIN_ID}-email-login], a[href$="/auth/forgot-password"] { display: none !important; }`;
  document.head.appendChild(el);
};

const update = (options) => {
  if (!isLoginPage()) {
    setEmailLoginHidden(false);
    return;
  }

  const form = findLoginForm();
  if (!form) return;

  if (!options.emailLoginEnabled) {
    form.setAttribute(`data-${PLUGIN_ID}-email-login`, '');
    setEmailLoginHidden(true);
  }

  if (options.ssoLoginEnabled && !document.getElementById(BUTTON_ID)) {
    form.insertAdjacentElement('afterend', createButton(options));
  }
};

export const installLoginButton = () => {
  fetchLoginOptions().then((options) => {
    if (!options) return;
    const run = () => update(options);
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
    run();
  });
};
