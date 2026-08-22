import type { TFunction } from 'i18next';
import { namespaceId, type NotificationSeverity, type SmartNotification } from '../../core/types';
import { interpretationLabel, type LabNotification, type NotificationTag } from './lab-notification-model';

export const labResultsSourceId = 'lab-results';

/**
 * Where "View in chart" lands. Matches the `path` of the test-results dashboard registered by
 * `esm-patient-tests-app`.
 */
const resultsDashboardPath = 'results';

/**
 * Maps the lab source's own severity tags onto the shared scale.
 *
 * A rejected sample sits alongside STAT rather than below it: nothing is coming back until someone
 * acts, so it needs attention even though no value was ever produced.
 */
const severityByTag: Record<NotificationTag, NotificationSeverity> = {
  CRITICAL: 'critical',
  STAT: 'high',
  SAMPLE_REJECTED: 'high',
  ROUTINE: 'low',
};

function tagLabel(tag: NotificationTag, t: TFunction): string {
  switch (tag) {
    case 'CRITICAL':
      return t('tagCritical', 'Critical');
    case 'STAT':
      return t('tagStat', 'Stat');
    case 'SAMPLE_REJECTED':
      return t('tagSampleRejected', 'Sample rejected');
    case 'ROUTINE':
    default:
      return t('tagRoutine', 'Routine');
  }
}

/** "320" + "µmol/L" -> "320 µmol/L". Either part may be missing. */
function valueWithUnits(notification: LabNotification): string {
  return [notification.value, notification.units].filter(Boolean).join(' ');
}

/**
 * Converts a lab notification into the shape the inbox renders.
 *
 * Everything is translated here, at the boundary, because the core has no vocabulary for tests,
 * reference ranges or ordering clinicians — that is what keeps it reusable for the next source.
 *
 * `interpolation: { escapeValue: false }` on the strings that carry units or concept names: i18next
 * escapes characters like the solidus by default, which React would then render literally as
 * "U&#x2F;L". React escapes on render anyway, so this only avoids double-escaping.
 */
export function toSmartNotification(notification: LabNotification, t: TFunction): SmartNotification {
  const value = valueWithUnits(notification);

  const subtitle =
    notification.rejectionReason ??
    t('interpretationAndRange', '{{interpretation}} · Ref {{range}}', {
      interpretation: interpretationLabel(notification.interpretation, t),
      range: notification.referenceRangeText,
      interpolation: { escapeValue: false },
    });

  const detailFields = [
    {
      label: t('test', 'Test'),
      value: notification.testLabel ?? '--',
      secondary: notification.panelLabel,
    },
    {
      label: t('result', 'Result'),
      value: value || '--',
      secondary: subtitle,
    },
    {
      label: t('orderingClinician', 'Ordering clinician'),
      value: notification.ordererDisplay ?? '--',
    },
    {
      label: t('location', 'Location'),
      value: notification.locationDisplay ?? '--',
      secondary: t('orderNumberValue', 'Order number {{orderNumber}}', {
        orderNumber: notification.orderNumber ?? '--',
      }),
    },
  ];

  return {
    id: namespaceId(labResultsSourceId, notification.id),
    sourceId: labResultsSourceId,
    severity: severityByTag[notification.tag],
    severityLabel: tagLabel(notification.tag, t),
    kindLabel: t('labResult', 'Lab result'),
    patientUuid: notification.patientUuid,
    title: value
      ? t('testAndValue', '{{test}} — {{value}}', {
          test: notification.testLabel,
          value,
          interpolation: { escapeValue: false },
        })
      : (notification.testLabel ?? '--'),
    subtitle,
    date: notification.resultDate ?? '',
    detailFields,
    chartPath: resultsDashboardPath,
    data: notification,
  };
}
