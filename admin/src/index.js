import { installLoginButton } from './login-page';
import { PLUGIN_ID } from './pluginId';

export default {
  register(app) {
    app.registerPlugin({
      id: PLUGIN_ID,
      name: 'Azure SSO',
    });
  },

  bootstrap() {
    installLoginButton();
  },
};
