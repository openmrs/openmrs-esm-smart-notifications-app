import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { showModal, showSnackbar, useSession } from '@openmrs/esm-framework';
import { smartNotificationDetailModalName } from '../constants';
import { getSourceSlot } from './notification-aggregate';
import { getNotificationSource } from './notification-source';
import { markNotificationRead } from './read-store';
import { markNotificationReviewed } from './review-store';
import type { SmartNotification } from './types';

/**
 * The two lifecycle verbs, applied in one place so the header bell, the panel rows and the
 * full-page inbox behave identically.
 *
 * Both write to the core's own stores first and then tell the source, rather than the other way
 * round. A source with a server-side lifecycle (the `notifications` backend module, say) can fail
 * or be offline; when it does, the clinician's triage must still stick locally rather than the row
 * springing back into the inbox.
 */

function reportFailure(title: string, error: unknown) {
  showSnackbar({ kind: 'error', title, subtitle: error instanceof Error ? error.message : undefined });
}

/** Opening the detail dialog is what "reading" means, so the badge drops as the dialog opens. */
export function markRead(notification: SmartNotification, onFailure: (error: unknown) => void) {
  markNotificationRead(notification.id);

  const source = getNotificationSource(notification.sourceId);
  Promise.resolve(source?.markRead?.(notification)).catch(onFailure);
}

export function markReviewed(
  notification: SmartNotification,
  providerDisplay: string,
  onFailure: (error: unknown) => void,
) {
  markNotificationReviewed(notification.id, notification.patientUuid, providerDisplay, notification.title);

  const source = getNotificationSource(notification.sourceId);
  Promise.resolve(source?.markReviewed?.(notification, { providerDisplay }))
    .then(() => getSourceSlot(notification.sourceId).mutate())
    .catch(onFailure);
}

/**
 * Opens a notification: marks it read and shows the detail modal. The row stays in the inbox until
 * it is explicitly reviewed.
 */
export function useOpenNotification() {
  const { t } = useTranslation();

  return useCallback(
    (notification: SmartNotification) => {
      markRead(notification, (error) =>
        reportFailure(t('markAsReadFailed', 'Could not mark the notification as read'), error),
      );

      const dispose = showModal(smartNotificationDetailModalName, {
        closeModal: () => dispose(),
        notification,
      });
    },
    [t],
  );
}

/** Signs a notification off, clearing it from the inbox. */
export function useReviewNotification() {
  const { t } = useTranslation();
  const session = useSession();
  const providerDisplay = session?.user?.person?.display ?? session?.user?.display ?? '';

  return useCallback(
    (notification: SmartNotification) => {
      markReviewed(notification, providerDisplay, (error) =>
        reportFailure(t('markAsReviewedFailed', 'Could not mark the notification as reviewed'), error),
      );
    },
    [providerDisplay, t],
  );
}
