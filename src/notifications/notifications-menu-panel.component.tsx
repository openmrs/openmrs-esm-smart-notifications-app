import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { CloseIcon, useSession } from '@openmrs/esm-framework';
import { markAllNotificationsReviewed, type SmartNotification } from './notification.resource';
import NotificationItem from './notification-item.component';
import styles from './notifications-menu-panel.scss';

interface NotificationsMenuPanelProps {
  expanded: boolean;
  notifications: Array<SmartNotification>;
  onClose: () => void;
}

const NotificationsMenuPanel: React.FC<NotificationsMenuPanelProps> = ({ expanded, notifications, onClose }) => {
  const { t } = useTranslation();
  const session = useSession();

  const reviewerName = useMemo(
    () => session?.user?.person?.display ?? session?.user?.display ?? t('unknownReviewer', 'Unknown user'),
    [session, t],
  );

  const hasUnread = useMemo(() => notifications.some((notification) => !notification.read), [notifications]);

  const handleMarkAllReviewed = useCallback(() => {
    markAllNotificationsReviewed(reviewerName);
  }, [reviewerName]);

  if (!expanded) {
    return null;
  }

  return (
    <aside className={styles.panel} aria-label={t('notificationsPanel', 'Notifications panel')}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t('notificationsHeading', 'Notifications')}</h2>
        <div className={styles.headerActions}>
          {hasUnread && (
            <Button kind="ghost" size="sm" onClick={handleMarkAllReviewed}>
              {t('markAllReviewed', 'Mark all reviewed')}
            </Button>
          )}
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            iconDescription={t('closeNotificationsPanel', 'Close notifications')}
            renderIcon={CloseIcon}
            onClick={onClose}
          />
        </div>
      </header>
      <div className={styles.body}>
        {notifications.length === 0 ? (
          <p className={styles.emptyState}>{t('noNotifications', 'You have no notifications.')}</p>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              reviewerName={reviewerName}
              onNavigate={onClose}
            />
          ))
        )}
      </div>
    </aside>
  );
};

export default NotificationsMenuPanel;
