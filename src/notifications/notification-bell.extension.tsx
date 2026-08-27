import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { HeaderGlobalAction } from '@carbon/react';
import { Notification } from '@carbon/react/icons';
import { useConfig, useOnClickOutside } from '@openmrs/esm-framework';
import { type ConfigSchema } from '../config-schema';
import { useNotifications } from './notification.resource';
import NotificationsMenuPanel from './notifications-menu-panel.component';
import styles from './notification-bell.scss';

/**
 * The notification bell rendered in the OpenMRS top navigation bar via the
 * `top-nav-actions-slot` extension slot. It always renders and surfaces the count
 * of unread high-acuity notifications as a badge, toggling a slide-over panel.
 */
const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const { badge } = useConfig<ConfigSchema>();
  const { notifications, unreadCount } = useNotifications(badge.countRoutineNotifications);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const wrapperRef = useOnClickOutside<HTMLDivElement>(() => setIsPanelOpen(false), isPanelOpen);

  const togglePanel = useCallback(() => setIsPanelOpen((open) => !open), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const badgeLabel = unreadCount > badge.maxCount ? `${badge.maxCount}+` : `${unreadCount}`;
  const buttonLabel =
    unreadCount > 0
      ? t('notificationsWithCount', '{{count}} unread notifications', { count: unreadCount })
      : t('notificationsTooltip', 'Notifications');

  return (
    <div ref={wrapperRef} className={styles.bellWrapper}>
      <HeaderGlobalAction
        aria-label={buttonLabel}
        className={classNames(styles.headerGlobalBarButton, { [styles.activePanel]: isPanelOpen })}
        isActive={isPanelOpen}
        onClick={togglePanel}
      >
        <Notification size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {badgeLabel}
          </span>
        )}
      </HeaderGlobalAction>
      <NotificationsMenuPanel expanded={isPanelOpen} notifications={notifications} onClose={closePanel} />
    </div>
  );
};

export default NotificationBell;
