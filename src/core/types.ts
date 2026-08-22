/**
 * The generic notification contract.
 *
 * The core owns the bell, the inbox rows, the detail modal and the read/review lifecycle. It knows
 * nothing about labs, prescriptions or any other clinical domain: a *source* decides what is worth
 * raising and hands back {@link SmartNotification}s in this shape, already translated. Adding a new
 * kind of notification means writing a source, not touching any component here.
 */

/**
 * Urgency, on a scale every source maps onto. It drives the tag colour and the inbox ordering, so
 * two sources' notifications can be interleaved into one list that still reads most-urgent-first.
 */
export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Most severe first. The index in this array is the sort rank. */
export const notificationSeverities: ReadonlyArray<NotificationSeverity> = ['critical', 'high', 'medium', 'low'];

/**
 * One labelled fact in the detail modal's grid. Sources emit these rather than JSX so that every
 * notification is laid out identically no matter which source raised it.
 */
export interface NotificationDetailField {
  /** Already translated by the source; the core has no key for it. */
  label: string;
  value: string;
  /** Optional second line under the value, e.g. a reference range or an order number. */
  secondary?: string;
}

export interface SmartNotification {
  /** Globally unique. Sources build it as `${sourceId}:${theirOwnId}` via {@link namespaceId}. */
  id: string;
  sourceId: string;
  severity: NotificationSeverity;
  /** Tag text, already translated, e.g. "Critical", "Stat", "Sample rejected". */
  severityLabel: string;
  /** What kind of thing this is, already translated, e.g. "Lab result", "Prescription". */
  kindLabel: string;
  /** The subject, when there is one. Drives the patient header and "View in chart". */
  patientUuid?: string;
  /** Headline, e.g. "Serum creatinine — 320 µmol/L". */
  title: string;
  /** Supporting line, e.g. "Critically high · Ref 60–110 µmol/L". */
  subtitle?: string;
  /** ISO timestamp of the event, not of when it was fetched. */
  date: string;
  detailFields: Array<NotificationDetailField>;
  /**
   * Chart path "View in chart" navigates to, relative to the patient chart root — e.g. `Results`.
   * Defaults to the chart summary when a source does not care.
   */
  chartPath?: string;
  /** Opaque to the core; handed back to the source's own `markRead` / `markReviewed`. */
  data?: unknown;
}

/** What a source is told about the app when it is asked for notifications. */
export interface NotificationSourceContext {
  /** The chart currently open, or null. Patient-scoped sources return nothing when this is null. */
  patientUuid: string | null;
  /** The signed-in user. Recipient-scoped sources return nothing when this is null. */
  userUuid: string | null;
}

export interface NotificationSourceResult {
  notifications: Array<SmartNotification>;
  isLoading: boolean;
  error: Error | null;
  /** Refetches this source. The core calls it after a lifecycle transition. */
  mutate: () => void;
}

export interface NotificationSource {
  /** Stable, unique, kebab-case. Namespaces this source's notification ids and its store slot. */
  id: string;
  /**
   * A React hook. It is called from a component dedicated to this source
   * (see `notification-aggregator.tsx`), so a source may use as many hooks as it likes without
   * constraining any other source.
   */
  useNotifications(context: NotificationSourceContext): NotificationSourceResult;
  /**
   * Mirror "the clinician opened this" wherever the source keeps its own state. The core already
   * records read state locally, so a source with no server-side lifecycle can omit this.
   */
  markRead?(notification: SmartNotification): void | Promise<void>;
  /**
   * Mirror "the clinician signed this off". Same as {@link markRead}: optional, because the core
   * records review state locally either way.
   */
  markReviewed?(notification: SmartNotification, context: { providerDisplay: string }): void | Promise<void>;
}

/** Builds the globally unique id for a notification from a source's own local id. */
export function namespaceId(sourceId: string, localId: string): string {
  return `${sourceId}:${localId}`;
}

/** Position of a severity in the most-severe-first ordering. Unknown values sort last. */
export function severityRank(severity: NotificationSeverity): number {
  const rank = notificationSeverities.indexOf(severity);
  return rank === -1 ? notificationSeverities.length : rank;
}

/**
 * Most severe first, then most recent first within a severity. This is what lets two sources'
 * notifications share one list without either one clumping at the top.
 */
export function compareNotifications(a: SmartNotification, b: SmartNotification): number {
  const bySeverity = severityRank(a.severity) - severityRank(b.severity);
  if (bySeverity !== 0) {
    return bySeverity;
  }
  return (b.date ?? '').localeCompare(a.date ?? '');
}
