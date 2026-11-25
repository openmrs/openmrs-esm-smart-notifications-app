import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { _resetAggregate, publishSourceResult } from './notification-aggregate';
import { markNotificationRead, _resetReadStore, setReadUser } from './read-store';
import { markNotificationReviewed, _resetReviewStore, setReviewUser } from './review-store';
import { useNotifications } from './use-notifications';
import type { NotificationSeverity, SmartNotification } from './types';

function build(id: string, severity: NotificationSeverity, date: string, sourceId = 'source-a'): SmartNotification {
  return {
    id,
    sourceId,
    severity,
    severityLabel: severity,
    kindLabel: 'Thing',
    title: id,
    date,
    detailFields: [],
  };
}

const slot = (notifications: Array<SmartNotification>, over: Partial<{ isLoading: boolean; error: Error }> = {}) => ({
  notifications,
  isLoading: over.isLoading ?? false,
  error: over.error ?? null,
  mutate: vi.fn(),
});

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAggregate();
    _resetReadStore();
    _resetReviewStore();
  });

  it('merges every source into one list, most severe first then most recent', () => {
    publishSourceResult(
      'source-a',
      slot([
        build('a-low', 'low', '2026-06-29T09:00:00.000Z'),
        build('a-critical', 'critical', '2026-06-29T08:00:00.000Z'),
      ]),
    );
    publishSourceResult('source-b', slot([build('b-critical', 'critical', '2026-06-29T10:00:00.000Z', 'source-b')]));

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications.map((notification) => notification.id)).toEqual([
      'b-critical',
      'a-critical',
      'a-low',
    ]);
  });

  it('counts everything the clinician has not opened yet', () => {
    setReadUser('user-1');
    publishSourceResult(
      'source-a',
      slot([build('one', 'low', '2026-06-29T09:00:00.000Z'), build('two', 'low', '2026-06-29T08:00:00.000Z')]),
    );

    const { result, rerender } = renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(2);

    markNotificationRead('one');
    rerender();

    // Reading silences the badge but leaves the row in the inbox.
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.notifications).toHaveLength(2);
  });

  it('drops a reviewed notification from the list entirely', () => {
    setReviewUser('user-1');
    publishSourceResult('source-a', slot([build('one', 'low', '2026-06-29T09:00:00.000Z')]));

    const { result, rerender } = renderHook(() => useNotifications());
    expect(result.current.notifications).toHaveLength(1);

    markNotificationReviewed('one', 'patient-1', 'Dr. Amoit');
    rerender();

    expect(result.current.notifications).toEqual([]);
  });

  // One source failing must not blank the other: a broken backend cannot hide a critical lab result.
  it('still lists a healthy source when a sibling errors', () => {
    publishSourceResult('source-a', slot([build('a-one', 'critical', '2026-06-29T09:00:00.000Z')]));
    publishSourceResult('source-b', slot([], { error: new Error('Network down') }));

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications.map((notification) => notification.id)).toEqual(['a-one']);
    expect(result.current.error?.message).toBe('Network down');
  });

  // Likewise a slow source must not hold the whole inbox on a skeleton.
  it('stops loading as soon as one source has reported', () => {
    publishSourceResult('source-a', slot([build('a-one', 'low', '2026-06-29T09:00:00.000Z')]));
    publishSourceResult('source-b', slot([], { isLoading: true }));

    const { result } = renderHook(() => useNotifications());

    expect(result.current.isLoading).toBe(false);
  });

  it('is loading while no source has reported at all', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notifications).toEqual([]);
  });

  it('refetches every source at once', () => {
    const a = slot([]);
    const b = slot([]);
    publishSourceResult('source-a', a);
    publishSourceResult('source-b', b);

    const { result } = renderHook(() => useNotifications());
    result.current.mutate();

    expect(a.mutate).toHaveBeenCalled();
    expect(b.mutate).toHaveBeenCalled();
  });
});
