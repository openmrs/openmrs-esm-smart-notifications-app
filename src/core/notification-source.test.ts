import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetNotificationSources,
  getNotificationSource,
  getNotificationSources,
  registerNotificationSource,
  unregisterNotificationSource,
} from './notification-source';
import type { NotificationSource } from './types';

const buildSource = (id: string): NotificationSource => ({
  id,
  useNotifications: () => ({ notifications: [], isLoading: false, error: null, mutate: vi.fn() }),
});

describe('the notification source registry', () => {
  beforeEach(() => {
    _resetNotificationSources();
  });

  it('registers a source and hands it back by id', () => {
    const source = buildSource('lab-results');

    registerNotificationSource(source);

    expect(getNotificationSources()).toEqual([source]);
    expect(getNotificationSource('lab-results')).toBe(source);
  });

  it('keeps several sources, in registration order', () => {
    registerNotificationSource(buildSource('lab-results'));
    registerNotificationSource(buildSource('notifications-backend'));

    expect(getNotificationSources().map((source) => source.id)).toEqual(['lab-results', 'notifications-backend']);
  });

  // A hot reload, or a module loaded twice by two distro entries, must not make every notification
  // that source produces appear twice in the inbox.
  it('replaces a source registered again under the same id rather than adding a second', () => {
    registerNotificationSource(buildSource('lab-results'));
    const replacement = buildSource('lab-results');

    registerNotificationSource(replacement);

    expect(getNotificationSources()).toEqual([replacement]);
  });

  it('drops a source when it is unregistered', () => {
    registerNotificationSource(buildSource('lab-results'));
    registerNotificationSource(buildSource('notifications-backend'));

    unregisterNotificationSource('lab-results');

    expect(getNotificationSources().map((source) => source.id)).toEqual(['notifications-backend']);
  });

  it('ignores an unregister for a source that was never registered', () => {
    registerNotificationSource(buildSource('lab-results'));

    unregisterNotificationSource('nothing-here');

    expect(getNotificationSources()).toHaveLength(1);
  });

  it('returns undefined for an unknown id', () => {
    expect(getNotificationSource('nothing-here')).toBeUndefined();
  });
});
