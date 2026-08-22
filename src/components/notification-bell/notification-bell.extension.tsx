import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HeaderGlobalAction } from '@carbon/react';
import { Notification as NotificationIcon, NotificationNew } from '@carbon/react/icons';
import { useConfig, useSession } from '@openmrs/esm-framework';
import { notificationsPanelName } from '../../constants';
import NotificationAggregator from '../../core/notification-aggregator.component';
import { setOptInUser } from '../../core/opt-in-store';
import { setNotificationsPanelClose } from '../../core/panel-controls';
import { setReadUser } from '../../core/read-store';
import { setReviewUser } from '../../core/review-store';
import { useNotifications } from '../../core/use-notifications';
import type { ConfigSchema } from '../../config-schema';
import styles from './notification-bell.scss';

/**
 * Props the app shell's `notifications-menu-button-slot` supplies. It hands over a subset of what
 * `top-nav-actions-slot` gets — there is no `hidePanel` here.
 */
export interface NotificationBellProps {
  isActivePanel(panelName: string): boolean;
  togglePanel(panelName: string): void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ isActivePanel, togglePanel }) => {
  const { t } = useTranslation();
  const session = useSession();
  const { unreadCount } = useNotifications();

  const userUuid = session?.user?.uuid;
  const isPanelOpen = isActivePanel?.(notificationsPanelName) ?? false;

  // Review, read and opt-in state are all per-user; point the stores at whoever is signed in before
  // reading them.
  useEffect(() => {
    if (userUuid) {
      setReviewUser(userUuid);
      setReadUser(userUuid);
      setOptInUser(userUuid);
    }
  }, [userUuid]);

  const closePanel = useCallback(() => {
    if (isActivePanel?.(notificationsPanelName)) {
      togglePanel?.(notificationsPanelName);
    }
  }, [isActivePanel, togglePanel]);

  // The rows live in a different slot and are never handed togglePanel, so publish the way back out
  // for them. See core/panel-controls.
  useEffect(() => {
    setNotificationsPanelClose(isPanelOpen ? closePanel : null);
    return () => setNotificationsPanelClose(null);
  }, [closePanel, isPanelOpen]);

  useEffect(() => {
    if (!isPanelOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closePanel, isPanelOpen]);

  const BellIcon = unreadCount > 0 ? NotificationNew : NotificationIcon;

  const bellLabel =
    unreadCount > 0
      ? t('notificationsWithCount', '{{count}} unread notifications', { count: unreadCount })
      : t('notifications', 'Notifications');

  return (
    <>
      {/* Renders nothing; drives every registered source. The bell owns it because it is the one
          piece of this module the shell mounts on every page. */}
      <NotificationAggregator />
      <HeaderGlobalAction
        aria-label={bellLabel}
        aria-expanded={isPanelOpen}
        className={styles.bellButton}
        isActive={isPanelOpen}
        onClick={() => togglePanel?.(notificationsPanelName)}
        tooltipAlignment="end"
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span aria-hidden="true" className={styles.bellBadge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </HeaderGlobalAction>
    </>
  );
};

/**
 * Gates the bell on config alone.
 *
 * Deliberately *not* gated on there being an open chart. Whether notifications exist outside a chart
 * is a question for the sources: a recipient-scoped one such as the `notifications` backend has
 * plenty to say with no patient open, while a patient-scoped one such as lab results returns nothing
 * and stays silent on its own.
 */
const NotificationBellGate: React.FC<NotificationBellProps> = (props) => {
  const { enabled } = useConfig<ConfigSchema>();

  if (!enabled) {
    return null;
  }

  return <NotificationBell {...props} />;
};

export default NotificationBellGate;
