import type { NotificationSeverity } from '../../core/types';
import {
  actionableStatuses,
  type Notification,
  type NotificationMetadata,
  notificationPriorities,
  type NotificationPriority,
  type NotificationType,
} from './types';

/**
 * Pure presentation helpers. These deliberately return i18n *keys* and Carbon
 * tag types rather than user-facing strings, so translation stays in the
 * components where `t` is available.
 */

/**
 * Parses the backend's free-form `metadata` column. It is written by the
 * server as a JSON string, but it is a nullable varchar, so anything could be
 * in there; a bad value must never break the inbox.
 */
export function parseNotificationMetadata(raw: string | null | undefined): NotificationMetadata {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as NotificationMetadata) : {};
  } catch {
    return {};
  }
}

/** When the notification was raised. Falls back to null when audit info was not requested. */
export function getNotificationDate(notification: Notification): string | null {
  return notification.auditInfo?.dateCreated ?? null;
}

/** True when the notification still belongs in the inbox. */
export function isActionable(notification: Notification): boolean {
  return !notification.voided && actionableStatuses.includes(notification.status);
}

export function isUnread(notification: Notification): boolean {
  return !notification.voided && notification.status === 'UNREAD';
}

/** Position of a priority in the LOW → HIGH ordering, for threshold comparisons. */
export function priorityRank(priority: NotificationPriority): number {
  const rank = notificationPriorities.indexOf(priority);
  return rank === -1 ? 0 : rank;
}

export function meetsMinimumPriority(notification: Notification, minimum: NotificationPriority): boolean {
  return priorityRank(notification.priority) >= priorityRank(minimum);
}

/**
 * Maps the backend's priority onto the inbox's shared severity scale.
 *
 * `HIGH` becomes `critical` rather than `high` because it is this source's top tier — the one its
 * rule engine assigns to a critical value — and the inbox interleaves sources by severity. Mapping
 * it any lower would sort a genuinely critical backend notification underneath a locally derived
 * one, which is exactly the ordering a clinician must be able to trust.
 */
export function prioritySeverity(priority: NotificationPriority): NotificationSeverity {
  switch (priority) {
    case 'HIGH':
      return 'critical';
    case 'MEDIUM':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * The label helpers take `t` rather than returning a key so the English
 * fallback lives next to the key and stays extractable. `tools/i18next-parser`
 * scans this file for that reason.
 */
type TranslateFn = (key: string, fallback: string) => string;

export function priorityLabel(priority: NotificationPriority, t: TranslateFn): string {
  switch (priority) {
    case 'HIGH':
      return t('priorityHigh', 'High');
    case 'MEDIUM':
      return t('priorityMedium', 'Medium');
    default:
      return t('priorityLow', 'Low');
  }
}

export function typeLabel(type: NotificationType, t: TranslateFn): string {
  switch (type) {
    case 'LAB_RESULT':
      return t('typeLabResult', 'Lab result');
    case 'PRESCRIPTION':
      return t('typePrescription', 'Prescription');
    case 'SAMPLE_REJECTED':
      return t('typeSampleRejected', 'Sample rejected');
    default:
      return t('typeGeneral', 'General');
  }
}

/**
 * Most recent first. Notifications with no audit info sort last rather than
 * jumping to the top, so a partial representation cannot reorder the inbox.
 */
export function byMostRecent(a: Notification, b: Notification): number {
  const left = getNotificationDate(a);
  const right = getNotificationDate(b);

  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }

  return new Date(right).getTime() - new Date(left).getTime();
}

/**
 * Applies the display filters and ordering that the inbox and the bell badge
 * both need, so the count on the bell can never disagree with the list.
 */
export function selectInboxNotifications(
  notifications: Array<Notification>,
  { minimumPriority, types }: { minimumPriority: NotificationPriority; types: ReadonlyArray<NotificationType> },
): Array<Notification> {
  return notifications
    .filter(
      (notification) =>
        isActionable(notification) &&
        meetsMinimumPriority(notification, minimumPriority) &&
        types.includes(notification.type),
    )
    .sort(byMostRecent);
}
