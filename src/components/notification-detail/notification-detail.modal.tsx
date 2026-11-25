import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { age, getPatientName, navigate, PatientPhoto } from '@openmrs/esm-framework';
import { useReviewNotification } from '../../core/notification-actions';
import { getPreferredIdentifier } from '../../core/patient-display';
import { formatRelativeTime } from '../../core/relative-time';
import { useChartPatient } from '../../core/use-chart-patient';
import type { SmartNotification } from '../../core/types';
import SeverityTag from '../notification-tag/notification-tag.component';
import styles from './notification-detail.scss';

interface NotificationDetailModalProps {
  closeModal: () => void;
  notification: SmartNotification;
}

/**
 * One modal for every source.
 *
 * The body is driven entirely by `detailFields`, which the source filled in and translated, so
 * adding a new kind of notification never means touching this file.
 */
const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({ closeModal, notification }) => {
  const { t } = useTranslation();
  const reviewNotification = useReviewNotification();
  const { patient } = useChartPatient();

  const relativeTime = formatRelativeTime(notification.date, t);

  // The patient header is only shown for the chart that is open, because that is the only record
  // whose demographics this module has to hand. A notification about someone else still shows its
  // own details and still navigates to the right chart.
  const isOpenChart = Boolean(patient && notification.patientUuid && notification.patientUuid === patient.id);
  const patientName = isOpenChart ? getPatientName(patient) : '';
  const identifier = isOpenChart ? getPreferredIdentifier(patient) : undefined;

  const handleMarkAsReviewed = useCallback(() => {
    reviewNotification(notification);
    closeModal();
  }, [closeModal, notification, reviewNotification]);

  // Deliberately does not clear the notification: the clinician is looking, not signing off.
  const handleViewInChart = useCallback(() => {
    const path = notification.chartPath ? `/chart/${notification.chartPath}` : '/chart';
    navigate({ to: `\${openmrsSpaBase}/patient/${notification.patientUuid}${path}` });
    closeModal();
  }, [closeModal, notification.chartPath, notification.patientUuid]);

  return (
    <>
      <ModalHeader className={styles.modalHeader} closeModal={closeModal}>
        <div className={styles.headerContent}>
          <SeverityTag label={notification.severityLabel} severity={notification.severity} />
          <span className={styles.headerMeta}>
            {t('kindAtTime', '{{kind}} · {{time}}', {
              kind: notification.kindLabel,
              time: relativeTime,
              interpolation: { escapeValue: false },
            })}
          </span>
        </div>
      </ModalHeader>
      <ModalBody className={styles.modalBody}>
        {isOpenChart && (
          <div className={styles.patientRow}>
            <span className={styles.modalAvatar}>
              <PatientPhoto patientName={patientName} patientUuid={patient.id} />
            </span>
            <div>
              <p className={styles.patientName}>{patientName}</p>
              <p className={styles.patientMeta}>
                {[
                  patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null,
                  patient?.birthDate ? age(patient.birthDate) : null,
                  identifier?.value ? `${identifier.label} ${identifier.value}`.trim() : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}

        <dl className={styles.detailGrid}>
          {notification.detailFields.map((field) => (
            <div className={styles.detailCell} key={field.label}>
              <dt className={styles.detailLabel}>{field.label}</dt>
              <dd className={styles.detailValue}>{field.value}</dd>
              {field.secondary && <dd className={styles.detailSubValue}>{field.secondary}</dd>}
            </div>
          ))}
        </dl>
      </ModalBody>
      <ModalFooter className={styles.modalFooter}>
        <Button kind="secondary" onClick={handleMarkAsReviewed} size="xl">
          {t('markAsReviewed', 'Mark as reviewed')}
        </Button>
        <Button disabled={!notification.patientUuid} kind="primary" onClick={handleViewInChart} size="xl">
          {t('viewInChart', 'View in chart')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default NotificationDetailModal;
