import { defineConfigSchema, getAsyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { moduleName } from './constants';
import { registerLabResultsSource } from './sources/lab-results';
import { registerNotificationsBackendSource } from './sources/notifications-backend';

const options = {
  featureName: 'smart-notifications',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);

  // The two built-in sources. Another frontend module adds its own the same way, by calling
  // `registerNotificationSource` from its own `startupApp` — the inbox picks it up with no change
  // here and no new UI to write.
  registerLabResultsSource();
  registerNotificationsBackendSource();
}

// Pages
export const root = getAsyncLifecycle(() => import('./root.component'), options);

// Extensions
export const notificationBell = getAsyncLifecycle(
  () => import('./components/notification-bell/notification-bell.extension'),
  options,
);

export const notificationRows = getAsyncLifecycle(
  () => import('./components/notification-panel/notification-panel.extension'),
  options,
);

// Modals
export const notificationDetailModal = getAsyncLifecycle(
  () => import('./components/notification-detail/notification-detail.modal'),
  options,
);

/**
 * The public API another frontend module needs to contribute a source or to read the triage state
 * this module owns. See `core/types.ts` for the notification contract.
 */
export { registerNotificationSource, unregisterNotificationSource } from './core/notification-source';
export { namespaceId } from './core/types';
export type {
  NotificationDetailField,
  NotificationSeverity,
  NotificationSource,
  NotificationSourceContext,
  NotificationSourceResult,
  SmartNotification,
} from './core/types';
export { setOptIn, setOptInUser, isOptedIn } from './core/opt-in-store';
export { useLatestReviewForPatient } from './core/review-store';
