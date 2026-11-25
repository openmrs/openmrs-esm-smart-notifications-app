/**
 * Shapes returned by the `notifications` OpenMRS backend module
 * (`openmrs-module-notifications`) at `/ws/rest/v1/notification`.
 *
 * The rules that decide *whether* a notification exists (STAT order, critical
 * value, sample rejection, abnormal-beyond-threshold) live server-side in that
 * module's `NotificationRuleEngine`. This frontend only renders what it is
 * given and drives the lifecycle transitions.
 */

/** The category of clinical event that raised the notification. */
export type NotificationType = 'LAB_RESULT' | 'PRESCRIPTION' | 'SAMPLE_REJECTED' | 'GENERAL';

export const notificationTypes: ReadonlyArray<NotificationType> = [
  'LAB_RESULT',
  'PRESCRIPTION',
  'SAMPLE_REJECTED',
  'GENERAL',
];

export const notificationPriorities: ReadonlyArray<NotificationPriority> = ['LOW', 'MEDIUM', 'HIGH'];

/**
 * Statuses that still need a clinician's attention. `REVIEWED` and `ARCHIVED` notifications have
 * been dealt with and drop out of the inbox.
 */
export const actionableStatuses: ReadonlyArray<NotificationStatus> = ['UNREAD', 'READ'];

/** Urgency, as decided by the backend rule engine. */
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Lifecycle state. `UNREAD` and `READ` are actionable and appear in the inbox;
 * `REVIEWED` and `ARCHIVED` have left it.
 */
export type NotificationStatus = 'UNREAD' | 'READ' | 'REVIEWED' | 'ARCHIVED';

export interface OpenmrsResourceRef {
  uuid: string;
  display?: string;
}

export interface AuditInfo {
  dateCreated: string;
  creator?: OpenmrsResourceRef;
  dateChanged?: string | null;
  changedBy?: OpenmrsResourceRef | null;
}

/** A notification in the `full` representation. */
export interface Notification {
  uuid: string;
  display: string;
  type: NotificationType;
  priority: NotificationPriority;
  message: string;
  status: NotificationStatus;
  patient: OpenmrsResourceRef | null;
  recipient: OpenmrsResourceRef | null;
  readAt: string | null;
  reviewedBy?: OpenmrsResourceRef | null;
  reviewedAt: string | null;
  /** Free-form JSON string; the lab listener records `{"obsUuid": "..."}`. */
  metadata?: string | null;
  voided?: boolean;
  auditInfo?: AuditInfo;
}

/** Parsed form of {@link Notification.metadata}. */
export interface NotificationMetadata {
  obsUuid?: string;
  [key: string]: unknown;
}
