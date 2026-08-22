import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, SkeletonText, Tile } from '@carbon/react';
import { ChevronRightIcon, useSession } from '@openmrs/esm-framework';
import NotificationAggregator from '../../core/notification-aggregator.component';
import { useOpenNotification } from '../../core/notification-actions';
import { setOptInUser } from '../../core/opt-in-store';
import RelativeTime from '../../core/relative-time.component';
import { setReviewUser } from '../../core/review-store';
import { setReadUser, useReadNotifications } from '../../core/read-store';
import { useNotifications } from '../../core/use-notifications';
import SeverityTag from '../notification-tag/notification-tag.component';
import styles from './notification-inbox.scss';

/**
 * The full-page view of the same inbox the header bell shows, for working through the list without
 * the slide-over. Reads the same aggregated store, so the two can never disagree.
 */
const NotificationInbox: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const { notifications, unreadCount, isLoading, error } = useNotifications();
  const read = useReadNotifications();
  const openNotification = useOpenNotification();

  const userUuid = session?.user?.uuid;

  // The bell normally does this, but the inbox can be opened as a bookmark before the header has
  // rendered anything, so point the per-user stores at the session here too.
  useEffect(() => {
    if (userUuid) {
      setReviewUser(userUuid);
      setReadUser(userUuid);
      setOptInUser(userUuid);
    }
  }, [userUuid]);

  return (
    <div className={styles.container}>
      <NotificationAggregator />
      <Layer>
        <Tile className={styles.tile}>
          <header className={styles.header}>
            <h1 className={styles.heading}>{t('notifications', 'Notifications')}</h1>
            {unreadCount > 0 ? (
              <span className={styles.unreadCount}>{t('unreadCount', '{{count}} unread', { count: unreadCount })}</span>
            ) : null}
          </header>

          {isLoading ? (
            <SkeletonText paragraph lineCount={4} />
          ) : error ? (
            <p className={styles.error}>{t('errorLoadingNotifications', "Couldn't load notifications.")}</p>
          ) : notifications.length === 0 ? (
            <>
              <p className={styles.emptyTitle}>{t('noNotifications', 'Nothing needs your attention')}</p>
              <p className={styles.emptyBody}>
                {t(
                  'noNotificationsBody',
                  'Anything that needs action shows up here. Routine, expected results are filed straight to the chart.',
                )}
              </p>
            </>
          ) : (
            <ul aria-label={t('notifications', 'Notifications')} className={styles.list}>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={`${styles.row} ${read[notification.id] ? '' : styles.unread}`}
                    onClick={() => openNotification(notification)}
                    type="button"
                  >
                    <span className={styles.rowBody}>
                      <span className={styles.rowMeta}>
                        <SeverityTag label={notification.severityLabel} severity={notification.severity} />
                        <span className={styles.rowKind}>{notification.kindLabel}</span>
                        <RelativeTime className={styles.rowTime} date={notification.date} />
                      </span>
                      <span className={styles.rowTitle}>{notification.title}</span>
                      {notification.subtitle && <span className={styles.rowSubtitle}>{notification.subtitle}</span>}
                    </span>
                    <ChevronRightIcon aria-hidden="true" className={styles.chevron} size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </Layer>
    </div>
  );
};

export default NotificationInbox;
