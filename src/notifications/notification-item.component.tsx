import React, { useCallback } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button, Tag, Tile } from '@carbon/react';
import { CheckmarkOutlineIcon, formatDatetime, navigate } from '@openmrs/esm-framework';
import { markNotificationReviewed, type NotificationAcuity, type SmartNotification } from './notification.resource';
import styles from './notification-item.scss';

interface NotificationItemProps {
  notification: SmartNotification;
  reviewerName: string;
  onNavigate?: () => void;
}

type TagType = 'red' | 'magenta' | 'gray';

const acuityTagType: Record<NotificationAcuity, TagType> = {
  stat: 'red',
  critical: 'magenta',
  routine: 'gray',
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, reviewerName, onNavigate }) => {
  const { t } = useTranslation();

  const acuityLabel: Record<NotificationAcuity, string> = {
    stat: t('acuityStat', 'STAT'),
    critical: t('acuityCritical', 'Critical'),
    routine: t('acuityRoutine', 'Routine'),
  };

  const handleMarkReviewed = useCallback(() => {
    markNotificationReviewed(notification.id, reviewerName);
  }, [notification.id, reviewerName]);

  const handleViewChart = useCallback(() => {
    if (notification.patientUuid) {
      markNotificationReviewed(notification.id, reviewerName);
      navigate({ to: `${window.getOpenmrsSpaBase()}patient/${notification.patientUuid}/chart` });
      onNavigate?.();
    }
  }, [notification.id, notification.patientUuid, reviewerName, onNavigate]);

  return (
    <Tile
      className={classNames(styles.item, {
        [styles.read]: notification.read,
        [styles.unread]: !notification.read,
      })}
    >
      <div className={styles.itemHeader}>
        <Tag className={styles.acuityTag} type={acuityTagType[notification.acuity]} size="sm">
          {acuityLabel[notification.acuity]}
        </Tag>
        <span className={styles.category}>{notification.category}</span>
        <span className={styles.timestamp}>
          {formatDatetime(new Date(notification.createdAt), { mode: 'standard' })}
        </span>
      </div>
      <h3 className={styles.title}>{notification.title}</h3>
      <p className={styles.message}>{notification.message}</p>
      {(notification.patientName || notification.location) && (
        <p className={styles.meta}>{[notification.patientName, notification.location].filter(Boolean).join(' · ')}</p>
      )}
      {notification.read ? (
        <p className={styles.reviewed}>
          <CheckmarkOutlineIcon size={16} className={styles.reviewedIcon} />
          {t('reviewedBy', 'Reviewed by {{reviewer}}', { reviewer: notification.reviewedBy })}
          {notification.reviewedAt
            ? ` · ${formatDatetime(new Date(notification.reviewedAt), { mode: 'standard' })}`
            : ''}
        </p>
      ) : (
        <div className={styles.actions}>
          {notification.patientUuid && (
            <Button kind="ghost" size="sm" onClick={handleViewChart}>
              {t('viewChart', 'View chart')}
            </Button>
          )}
          <Button kind="ghost" size="sm" renderIcon={CheckmarkOutlineIcon} onClick={handleMarkReviewed}>
            {t('markReviewed', 'Mark reviewed')}
          </Button>
        </div>
      )}
    </Tile>
  );
};

export default NotificationItem;
