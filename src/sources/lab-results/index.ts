import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { registerNotificationSource } from '../../core/notification-source';
import type { NotificationSourceContext, NotificationSourceResult } from '../../core/types';
import type { ConfigSchema } from '../../config-schema';
import { useLabNotifications } from './lab-notifications.resource';
import { labResultsSourceId, toSmartNotification } from './to-smart-notification';

/**
 * The lab-result source: notifications derived on the client from the patient's orders and their
 * FHIR observations. It needs no notification backend, which is what lets a distro run the inbox
 * with nothing installed but this frontend module.
 *
 * Patient-scoped — the derivation is per chart — so it stays quiet when no chart is open.
 */
function useLabResultNotifications({ patientUuid }: NotificationSourceContext): NotificationSourceResult {
  const { t } = useTranslation();
  const { enabled, pollingIntervalMs, sources } = useConfig<ConfigSchema>();
  const labResults = sources.labResults;

  const { notifications, isLoading, error, mutate } = useLabNotifications(patientUuid, {
    ...labResults,
    enabled: enabled && labResults.enabled,
    pollingIntervalMs,
  });

  const mapped = useMemo(
    () => notifications.map((notification) => toSmartNotification(notification, t)),
    [notifications, t],
  );

  return { notifications: mapped, isLoading, error, mutate };
}

export function registerLabResultsSource() {
  registerNotificationSource({
    id: labResultsSourceId,
    useNotifications: useLabResultNotifications,
  });
}

export { labResultsSourceId };
