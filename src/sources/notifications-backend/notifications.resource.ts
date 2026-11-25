import { useMemo } from 'react';
import { type FetchResponse, openmrsFetch, restBaseUrl, useOpenmrsSWR } from '@openmrs/esm-framework';
import { selectInboxNotifications } from './notification-display';
import type { Notification, NotificationPriority, NotificationStatus, NotificationType } from './types';

interface NotificationsResponse {
  results: Array<Notification>;
}

interface UseNotificationsOptions {
  enabled: boolean;
  pollingIntervalMs: number;
  maxNotifications: number;
  minimumPriority: NotificationPriority;
  types: ReadonlyArray<NotificationType>;
}

/** Stable identity so consumers' effects don't re-fire while loading. */
const emptyNotifications: Array<Notification> = [];

export function getNotificationsUrl(recipientUuid: string, limit: number): string {
  return `${restBaseUrl}/notification?recipient=${recipientUuid}&v=full&limit=${limit}`;
}

/**
 * Polls the backend for the signed-in user's notifications and narrows them to
 * the ones the inbox should show.
 *
 * The backend's search returns every status for a recipient, so filtering to
 * the actionable ones happens here. That keeps it to one request per poll.
 *
 * Read and review state are deliberately *not* applied here: the core tracks those across every
 * source, so the badge count is computed once rather than per source.
 */
export function useBackendNotifications(recipientUuid: string | undefined, options: UseNotificationsOptions) {
  const { enabled, pollingIntervalMs, maxNotifications, minimumPriority, types } = options;

  const url = enabled && recipientUuid ? getNotificationsUrl(recipientUuid, maxNotifications) : null;

  const { data, error, isLoading, mutate } = useOpenmrsSWR<NotificationsResponse>(url, {
    swrConfig: {
      refreshInterval: pollingIntervalMs,
      revalidateOnFocus: true,
    },
  });

  const notifications = useMemo(() => {
    const results = data?.data?.results;
    return results ? selectInboxNotifications(results, { minimumPriority, types }) : emptyNotifications;
  }, [data, minimumPriority, types]);

  return {
    notifications,
    error: (error as Error) ?? null,
    isLoading,
    mutate,
  };
}

/**
 * Transitions a notification's lifecycle. The backend's `status` property
 * setter routes READ/REVIEWED/ARCHIVED through the service layer so the audit
 * fields (`readAt`, `reviewedBy`, `reviewedAt`) are populated server-side —
 * the client must not try to set those itself.
 */
export function setNotificationStatus(
  notificationUuid: string,
  status: NotificationStatus,
  abortController?: AbortController,
): Promise<FetchResponse<Notification>> {
  return openmrsFetch(`${restBaseUrl}/notification/${notificationUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { status },
    signal: abortController?.signal,
  });
}

export function markNotificationAsRead(notificationUuid: string, abortController?: AbortController) {
  return setNotificationStatus(notificationUuid, 'READ', abortController);
}

export function markNotificationAsReviewed(notificationUuid: string, abortController?: AbortController) {
  return setNotificationStatus(notificationUuid, 'REVIEWED', abortController);
}
