import type { TFunction } from 'i18next';
import type { ObservationAssessment, OBSERVATION_INTERPRETATION } from './reference-ranges';

/**
 * The notification rule for lab results.
 *
 * This file is policy only: given an order and what its result *means*, does a clinician need to be
 * interrupted? Deciding what a value means — reading the concept's bounds, guarding against
 * mis-configured ones, calling it critical — happens in `reference-ranges.ts`, which is the single
 * place that touches reference ranges at all.
 */

/**
 * Severity tags, ordered most severe first. The order of this array is the tie-breaker used by
 * {@link classifyNotification}: a STAT order that comes back critical is tagged CRITICAL.
 */
export const notificationTags = ['CRITICAL', 'STAT', 'SAMPLE_REJECTED', 'ROUTINE'] as const;

export type NotificationTag = (typeof notificationTags)[number];

/**
 * The order fields the rule needs, matching the `v=custom:(...)` projection the resource requests.
 *
 * Deliberately narrow. The platform's full `Order` type carries sixty-odd fields, most of them about
 * drug orders, and none of the rest are read here.
 */
export interface LabOrder {
  uuid: string;
  orderNumber?: string;
  dateActivated?: string;
  display?: string;
  urgency?: string;
  fulfillerStatus?: string;
  fulfillerComment?: string;
  patient?: { uuid?: string };
  concept?: { uuid?: string; display?: string };
  orderer?: { display?: string; person?: { display?: string } };
  encounter?: { uuid?: string; location?: { uuid?: string; display?: string } };
}

/** A resulted observation, already assessed. Kept narrow so it is easy to fake in tests. */
export interface ResultedObservation {
  uuid: string;
  conceptUuid?: string;
  display?: string;
  panelDisplay?: string;
  value?: string;
  effectiveDateTime?: string;
  /** Supplied by `reference-ranges.ts`. The rule never derives this itself. */
  assessment: ObservationAssessment;
}

export interface LabNotification {
  id: string;
  tag: NotificationTag;
  patientUuid?: string;
  conceptUuid?: string;
  testLabel?: string;
  panelLabel?: string;
  value?: string;
  units?: string;
  interpretation?: OBSERVATION_INTERPRETATION;
  referenceRangeText: string;
  orderNumber?: string;
  ordererDisplay?: string;
  locationUuid?: string;
  locationDisplay?: string;
  encounterUuid?: string;
  resultDate?: string;
  rejectionReason?: string;
}

export interface ClassificationOptions {
  /** Config: also notify for abnormal-but-not-critical values. */
  notifyOnAbnormalNonCritical: boolean;
  /** Whether the clinician ticked "Notify me when resulted" for this patient + concept. */
  optedIn: boolean;
}

/** Human-readable interpretation, e.g. `CRITICALLY_LOW` -> "Critically low". */
export function interpretationLabel(interpretation: OBSERVATION_INTERPRETATION | undefined, t: TFunction): string {
  if (!interpretation) {
    return t('noInterpretation', 'No interpretation');
  }
  const words = interpretation.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Returns the tag to surface, or `null` when the result should file silently to the chart — the
 * whole point of the feature is that most results return `null`.
 *
 * Severity wins over provenance: a STAT order returning a critical value is CRITICAL, not STAT.
 */
export function classifyNotification(
  order: Pick<LabOrder, 'urgency' | 'fulfillerStatus'>,
  obs: ResultedObservation | undefined,
  options: ClassificationOptions,
): NotificationTag | null {
  // Rejection is the one trigger that doesn't need a result: there will never be one.
  if (order.fulfillerStatus === 'DECLINED') {
    return 'SAMPLE_REJECTED';
  }

  // Only resulted orders notify. A pending STAT order shows nothing until it has a result.
  if (!obs) {
    return null;
  }

  // Critical values always notify, regardless of how the test was ordered, and are not
  // configurable off — that is a patient-safety guarantee, not a preference.
  if (obs.assessment.isCritical) {
    return 'CRITICAL';
  }

  if (order.urgency === 'STAT') {
    return 'STAT';
  }

  if (options.optedIn) {
    return 'ROUTINE';
  }

  if (options.notifyOnAbnormalNonCritical && obs.assessment.isAbnormal) {
    return 'ROUTINE';
  }

  return null;
}

/**
 * Builds the notification a resulted (or rejected) order produces, or `null` when it files silently.
 */
export function toLabNotification(
  order: LabOrder,
  obs: ResultedObservation | undefined,
  options: ClassificationOptions,
): LabNotification | null {
  const tag = classifyNotification(order, obs, options);
  if (!tag) {
    return null;
  }

  return {
    id: `${order.uuid}:${obs?.uuid ?? 'rejected'}`,
    tag,
    patientUuid: order.patient?.uuid,
    conceptUuid: order.concept?.uuid,
    testLabel: obs?.display ?? order.concept?.display ?? order.display,
    panelLabel: obs?.panelDisplay,
    value: obs?.value,
    units: obs?.assessment.units,
    interpretation: obs?.assessment.interpretation,
    referenceRangeText: obs?.assessment.referenceRangeText ?? '--',
    orderNumber: order.orderNumber,
    ordererDisplay: order.orderer?.display ?? order.orderer?.person?.display,
    locationUuid: order.encounter?.location?.uuid,
    locationDisplay: order.encounter?.location?.display,
    encounterUuid: order.encounter?.uuid,
    resultDate: obs?.effectiveDateTime ?? order.dateActivated,
    rejectionReason: tag === 'SAMPLE_REJECTED' ? order.fulfillerComment : undefined,
  };
}

/** Most severe first, then most recent first within a tag. */
export function sortLabNotifications(notifications: Array<LabNotification>): Array<LabNotification> {
  return [...notifications].sort((a, b) => {
    const bySeverity = notificationTags.indexOf(a.tag) - notificationTags.indexOf(b.tag);
    if (bySeverity !== 0) {
      return bySeverity;
    }
    return (b.resultDate ?? '').localeCompare(a.resultDate ?? '');
  });
}
