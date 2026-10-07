import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openmrsFetch, restBaseUrl, useOpenmrsSWR } from '@openmrs/esm-framework';
import {
  getNotificationsUrl,
  markNotificationAsRead,
  markNotificationAsReviewed,
  setNotificationStatus,
  useBackendNotifications,
} from './notifications.resource';
import { type Notification, type NotificationPriority, notificationTypes } from './types';

const mockUseOpenmrsSWR = vi.mocked(useOpenmrsSWR);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const defaultOptions = {
  enabled: true,
  pollingIntervalMs: 30000,
  maxNotifications: 50,
  minimumPriority: 'LOW' as NotificationPriority,
  types: notificationTypes,
};

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    uuid: 'notification-1',
    display: 'New Serum Potassium result is available. [LAB_RESULT/HIGH]',
    type: 'LAB_RESULT',
    priority: 'HIGH',
    message: 'New Serum Potassium result is available.',
    status: 'UNREAD',
    patient: { uuid: 'patient-1', display: 'John Doe' },
    recipient: { uuid: 'user-1', display: 'Dr Jane' },
    readAt: null,
    reviewedAt: null,
    metadata: '{"obsUuid":"obs-1"}',
    voided: false,
    auditInfo: { dateCreated: '2026-07-20T10:00:00.000+0000' },
    ...overrides,
  };
}

function mockSwrResponse(results: Array<Notification>) {
  mockUseOpenmrsSWR.mockReturnValue({
    data: { data: { results } },
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useOpenmrsSWR>);
}

beforeEach(() => {
  mockSwrResponse([]);
});

describe('getNotificationsUrl', () => {
  it('requests the full representation for a recipient', () => {
    expect(getNotificationsUrl('user-1', 50)).toBe(`${restBaseUrl}/notification?recipient=user-1&v=full&limit=50`);
  });
});

describe('useNotifications', () => {
  it('fetches notifications for the given recipient', () => {
    renderHook(() => useBackendNotifications('user-1', defaultOptions));

    expect(mockUseOpenmrsSWR).toHaveBeenCalledWith(
      `${restBaseUrl}/notification?recipient=user-1&v=full&limit=50`,
      expect.objectContaining({ swrConfig: expect.objectContaining({ refreshInterval: 30000 }) }),
    );
  });

  it('does not fetch when there is no signed-in user yet', () => {
    renderHook(() => useBackendNotifications(undefined, defaultOptions));

    expect(mockUseOpenmrsSWR).toHaveBeenCalledWith(null, expect.anything());
  });

  it('does not fetch when the feature is disabled', () => {
    renderHook(() => useBackendNotifications('user-1', { ...defaultOptions, enabled: false }));

    expect(mockUseOpenmrsSWR).toHaveBeenCalledWith(null, expect.anything());
  });

  it('returns only the actionable notifications, leaving the unread count to the core', () => {
    mockSwrResponse([
      buildNotification({ uuid: 'unread', status: 'UNREAD' }),
      buildNotification({
        uuid: 'read',
        status: 'READ',
        auditInfo: { dateCreated: '2026-07-21T10:00:00.000+0000' },
      }),
      buildNotification({ uuid: 'reviewed', status: 'REVIEWED' }),
    ]);

    const { result } = renderHook(() => useBackendNotifications('user-1', defaultOptions));

    expect(result.current.notifications.map((notification) => notification.uuid)).toEqual(['read', 'unread']);
  });

  it('applies the configured minimum priority', () => {
    mockSwrResponse([
      buildNotification({ uuid: 'low', priority: 'LOW' }),
      buildNotification({ uuid: 'high', priority: 'HIGH' }),
    ]);

    const { result } = renderHook(() =>
      useBackendNotifications('user-1', { ...defaultOptions, minimumPriority: 'HIGH' }),
    );

    expect(result.current.notifications.map((notification) => notification.uuid)).toEqual(['high']);
  });

  it('returns an empty list while the request is in flight', () => {
    mockUseOpenmrsSWR.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isValidating: true,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useOpenmrsSWR>);

    const { result } = renderHook(() => useBackendNotifications('user-1', defaultOptions));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('surfaces fetch errors', () => {
    const error = new Error('Network down');
    mockUseOpenmrsSWR.mockReturnValue({
      data: undefined,
      error,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useOpenmrsSWR>);

    const { result } = renderHook(() => useBackendNotifications('user-1', defaultOptions));

    expect(result.current.error).toBe(error);
  });
});

describe('setNotificationStatus', () => {
  it('posts the new status to the notification resource', () => {
    setNotificationStatus('notification-1', 'REVIEWED');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/notification/notification-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { status: 'REVIEWED' },
      signal: undefined,
    });
  });

  it('passes an abort signal through when one is given', () => {
    const abortController = new AbortController();
    setNotificationStatus('notification-1', 'READ', abortController);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/notification/notification-1`,
      expect.objectContaining({ signal: abortController.signal }),
    );
  });

  it('exposes READ and REVIEWED shorthands', () => {
    markNotificationAsRead('notification-1');
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(
      `${restBaseUrl}/notification/notification-1`,
      expect.objectContaining({ body: { status: 'READ' } }),
    );

    markNotificationAsReviewed('notification-2');
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(
      `${restBaseUrl}/notification/notification-2`,
      expect.objectContaining({ body: { status: 'REVIEWED' } }),
    );
  });
});
