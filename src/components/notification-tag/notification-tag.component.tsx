import React from 'react';
import type { NotificationSeverity } from '../../core/types';
import styles from './notification-tag.scss';

type CarbonTagType = 'red' | 'magenta' | 'purple' | 'gray';

/** Carbon tag colours, most severe first. */
const tagTypes: Record<NotificationSeverity, CarbonTagType> = {
  critical: 'red',
  high: 'magenta',
  medium: 'purple',
  low: 'gray',
};

interface SeverityTagProps {
  severity: NotificationSeverity;
  /** Already translated by the source that raised the notification. */
  label: string;
}

/**
 * Colours a notification by severity.
 *
 * The label is passed in rather than derived, because only the source knows what its severities are
 * called — "Critical" and "Stat" for a lab result, "High" for a backend notification. The colour is
 * the core's, so two sources' rows still read as one list.
 *
 * Rendered as a plain span carrying Carbon's tag classes rather than as `<Tag>`, so it can sit
 * inside the row's `<button>` without nesting one interactive element inside another.
 */
const SeverityTag: React.FC<SeverityTagProps> = ({ severity, label }) => (
  <span className={`cds--tag cds--tag--sm cds--layout--size-sm cds--tag--${tagTypes[severity]} ${styles.severityTag}`}>
    {label}
  </span>
);

export default SeverityTag;
