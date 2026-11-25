import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { registerNotificationSource } from '../../core/notification-source';
import {
  namespaceId,
  type NotificationSourceContext,
  type NotificationSourceResult,
  type SmartNotification,
} from '../../core/types';
import type { ConfigSchema } from '../../config-schema';
import {
  getNotificationDate,
  parseNotificationMetadata,
  priorityLabel,
  prioritySeverity,
  typeLabel,
} from './notification-display';
import { markNotificationAsRead, markNotificationAsReviewed, useBackendNotifications } from './notifications.resource';
import type { Notification } from './types';

export const notificationsBackendSourceId = 'notifications-backend';

type TranslateFn = (key: string, fallback: string) => string;

/**
 * Converts a backend notification into the shape the inbox renders.
 *
 * The backend hands over a rendered `message` rather than structured parts, so that becomes the
 * title and the remaining columns become detail fields. Anything it does not supply is simply
 * omitted rather than filled with a placeholder.
 */
export function toSmartNotification(notification: Notification, t: TranslateFn): SmartNotification {
  const dateCreated = getNotificationDate(notification);
  const metadata = parseNotificationMetadata(notification.metadata);

  const detailFields = [
    notification.patient?.display && { label: t('patient', 'Patient'), value: notification.patient.display },
    notification.recipient?.display && { label: t('recipient', 'Recipient'), value: notification.recipient.display },
    metadata.obsUuid && { label: t('observationReference', 'Observation reference'), value: metadata.obsUuid },
  ].filter(Boolean) as SmartNotification['detailFields'];

  return {
    id: namespaceId(notificationsBackendSourceId, notification.uuid),
    sourceId: notificationsBackendSourceId,
    severity: prioritySeverity(notification.priority),
    severityLabel: priorityLabel(notification.priority, t),
    kindLabel: typeLabel(notification.type, t),
    patientUuid: notification.patient?.uuid,
    title: notification.message,
    date: dateCreated ?? '',
    detailFields,
    data: notification,
  };
}

/**
 * The `openmrs-module-notifications` source: notifications raised server-side, for the signed-in
 * user, across every patient.
 *
 * Recipient-scoped rather than chart-scoped, so unlike the lab source it keeps producing rows when
 * no chart is open. Disabled by default — with the backend module absent it would only ever 404.
 */
function useNotificationsBackendSource({ userUuid }: NotificationSourceContext): NotificationSourceResult {
  const { t } = useTranslation();
  const { enabled, pollingIntervalMs, sources } = useConfig<ConfigSchema>();
  const backend = sources.notificationsBackend;

  const { notifications, isLoading, error, mutate } = useBackendNotifications(userUuid ?? undefined, {
    enabled: enabled && backend.enabled,
    pollingIntervalMs,
    maxNotifications: backend.maxNotifications,
    minimumPriority: backend.minimumPriority,
    types: backend.notificationTypes,
  });

  const mapped = useMemo(
    () => notifications.map((notification) => toSmartNotification(notification, t)),
    [notifications, t],
  );

  return { notifications: mapped, isLoading, error, mutate };
}

export function registerNotificationsBackendSource() {
  registerNotificationSource({
    id: notificationsBackendSourceId,
    useNotifications: useNotificationsBackendSource,
    // The lifecycle lives server-side for this source, so the local transitions the core records are
    // mirrored to the backend, which stamps the audit fields (`readAt`, `reviewedBy`, `reviewedAt`).
    markRead: (notification) => markNotificationAsRead((notification.data as Notification).uuid).then(() => undefined),
    markReviewed: (notification) =>
      markNotificationAsReviewed((notification.data as Notification).uuid).then(() => undefined),
  });
}
