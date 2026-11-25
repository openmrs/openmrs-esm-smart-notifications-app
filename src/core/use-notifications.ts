import { useCallback, useMemo } from 'react';
import { useSourceSlots } from './notification-aggregate';
import { useReadNotifications } from './read-store';
import { useReviewedNotifications } from './review-store';
import { compareNotifications, type SmartNotification } from './types';

export interface UseNotificationsResult {
  /** Every source's notifications, reviewed ones removed, most urgent first. */
  notifications: Array<SmartNotification>;
  /** How many the clinician has not opened yet. This is the number on the bell. */
  unreadCount: number;
  /** True while any source is still loading and none has produced anything yet. */
  isLoading: boolean;
  /** The first error any source reported, or null. One broken source must not blank the others. */
  error: Error | null;
  /** Refetches every source. */
  mutate: () => void;
}

const noNotifications: Array<SmartNotification> = [];

/**
 * The one list.
 *
 * The bell's badge, the panel rows and the full-page inbox all read this, so the count on the bell
 * can never disagree with what opening it shows.
 */
export function useNotifications(): UseNotificationsResult {
  const slots = useSourceSlots();
  const reviewed = useReviewedNotifications();
  const read = useReadNotifications();

  const slotValues = useMemo(() => Object.values(slots), [slots]);

  const notifications = useMemo(() => {
    if (slotValues.length === 0) {
      return noNotifications;
    }

    return (
      slotValues
        .flatMap((slot) => slot.notifications)
        // Reviewed notifications leave the list and stay gone across reloads.
        .filter((notification) => !reviewed[notification.id])
        .sort(compareNotifications)
    );
  }, [reviewed, slotValues]);

  // Reading a notification silences the badge but leaves it in the inbox, so glancing at something
  // never makes it disappear.
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !read[notification.id]).length,
    [notifications, read],
  );

  // A source that has produced notifications is no longer blocking, even if a sibling is still
  // fetching — otherwise one slow source would hold the whole inbox on a skeleton.
  const isLoading = slotValues.length === 0 || slotValues.every((slot) => slot.isLoading);

  const error = useMemo(() => slotValues.find((slot) => slot.error)?.error ?? null, [slotValues]);

  const mutate = useCallback(() => {
    slotValues.forEach((slot) => slot.mutate());
  }, [slotValues]);

  return { notifications, unreadCount, isLoading, error, mutate };
}
