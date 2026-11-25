import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import { ChevronRightIcon, CloseIcon, getPatientName, PatientPhoto, useConfig } from '@openmrs/esm-framework';
import NotificationAggregator from '../../core/notification-aggregator.component';
import { useOpenNotification } from '../../core/notification-actions';
import { useCloseNotificationsPanel } from '../../core/panel-controls';
import { useReadNotifications } from '../../core/read-store';
import RelativeTime from '../../core/relative-time.component';
import { useChartPatient } from '../../core/use-chart-patient';
import { useNotifications } from '../../core/use-notifications';
import type { SmartNotification } from '../../core/types';
import type { ConfigSchema } from '../../config-schema';
import SeverityTag from '../notification-tag/notification-tag.component';
import styles from './notification-panel.scss';

interface NotificationRowProps {
  notification: SmartNotification;
  isUnread: boolean;
  onSelect: (notification: SmartNotification) => void;
  /** The open chart, used for the avatar when the notification is about that patient. */
  patient: fhir.Patient | null;
}

/**
 * One row. Everything it renders comes off the notification, so a row looks the same whichever
 * source produced it.
 */
const NotificationRow: React.FC<NotificationRowProps> = ({ notification, isUnread, onSelect, patient }) => {
  // Only show a photo when the row is about the chart that is open; the panel has no way to load a
  // photo for any other patient, and pairing one patient's picture with another's name would be
  // worse than showing none.
  const isOpenChart = Boolean(patient && notification.patientUuid && notification.patientUuid === patient.id);
  const patientName = isOpenChart ? getPatientName(patient) : '';

  return (
    <li>
      <button
        className={`${styles.row} ${isUnread ? styles.rowUnread : ''}`}
        onClick={() => onSelect(notification)}
        type="button"
      >
        {isOpenChart && (
          <span className={styles.avatar}>
            <PatientPhoto patientName={patientName} patientUuid={patient.id} />
          </span>
        )}
        <span className={styles.rowBody}>
          <span className={styles.rowMeta}>
            <SeverityTag label={notification.severityLabel} severity={notification.severity} />
            <span className={styles.rowKind}>{notification.kindLabel}</span>
            <RelativeTime className={styles.rowTime} date={notification.date} />
          </span>
          {patientName && <span className={styles.rowPatient}>{patientName}</span>}
          <span className={styles.rowTest}>{notification.title}</span>
          {notification.subtitle && <span className={styles.rowRange}>{notification.subtitle}</span>}
        </span>
        <ChevronRightIcon aria-hidden="true" className={styles.chevron} size={16} />
      </button>
    </li>
  );
};

const NotificationRows: React.FC = () => {
  const { t } = useTranslation();
  const { notifications, isLoading, error } = useNotifications();
  const read = useReadNotifications();
  const closePanel = useCloseNotificationsPanel();
  const openNotification = useOpenNotification();
  const { patient } = useChartPatient();

  return (
    <div className={styles.rows}>
      {/* Mounted here as well as on the bell so the panel still fills when it is the first thing
          rendered. Publishing is idempotent, so the two never fight. */}
      <NotificationAggregator />
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {t('notificationsNeedReview', '{{count}} notifications need review', { count: notifications.length })}
        </p>
        {/* The shell's panel has no close affordance of its own yet, so we keep ours. */}
        {closePanel && (
          <Button
            className={styles.closeButton}
            hasIconOnly
            iconDescription={t('closeNotifications', 'Close notifications')}
            kind="ghost"
            onClick={closePanel}
            renderIcon={CloseIcon}
            size="sm"
          />
        )}
      </div>

      {isLoading ? (
        <div className={styles.loading}>
          <SkeletonText paragraph lineCount={3} />
        </div>
      ) : error ? (
        <p className={styles.error}>{t('errorLoadingNotifications', "Couldn't load notifications.")}</p>
      ) : notifications.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>{t('noNotifications', 'Nothing needs your attention')}</p>
          <p className={styles.emptyStateBody}>
            {t(
              'noNotificationsBody',
              'Anything that needs action shows up here. Routine, expected results are filed straight to the chart.',
            )}
          </p>
        </div>
      ) : (
        <>
          <h3 className={styles.sectionLabel}>{t('requiresAttention', 'Requires attention')}</h3>
          <ul className={styles.list}>
            {notifications.map((notification) => (
              <NotificationRow
                isUnread={!read[notification.id]}
                key={notification.id}
                notification={notification}
                onSelect={openNotification}
                patient={patient}
              />
            ))}
          </ul>
        </>
      )}

      <div className={styles.footer}>
        <p>
          <strong>{t('smartFiltering', 'Smart filtering:')}</strong>{' '}
          {t(
            'smartFilteringExplainer',
            'only urgent and unexpected findings interrupt you. Routine, expected results are filed silently.',
          )}
        </p>
      </div>
    </div>
  );
};

/**
 * Renders the inbox rows into the app shell's own notifications panel
 * (`notifications-nav-menu-slot`). The shell owns the panel chrome — the HeaderPanel, its geometry,
 * the "Notifications" heading and mutual exclusion with the other header panels — so this renders
 * content only.
 */
const NotificationRowsGate: React.FC = () => {
  const { enabled } = useConfig<ConfigSchema>();

  if (!enabled) {
    return null;
  }

  return <NotificationRows />;
};

export default NotificationRowsGate;
