import { getAsyncLifecycle, defineConfigSchema } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { moduleName } from './constants';

const options = {
  featureName: 'smart-notifications-app',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

// Root component
export const root = getAsyncLifecycle(() => import('./root.component'), options);

// Extensions
export const notificationBell = getAsyncLifecycle(() => import('./notifications/notification-bell.extension'), options);

// Modals

// Workspaces
