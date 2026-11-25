import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  _resetAggregate,
  getSourceSlot,
  publishSourceResult,
  retractSourceResult,
  type SourceSlot,
} from './notification-aggregate';
import NotificationAggregator from './notification-aggregator.component';
import {
  _resetNotificationSources,
  registerNotificationSource,
  unregisterNotificationSource,
} from './notification-source';
import type { SmartNotification } from './types';

function build(id: string): SmartNotification {
  return {
    id,
    sourceId: 'source-a',
    severity: 'low',
    severityLabel: 'Low',
    kindLabel: 'Thing',
    title: id,
    date: '2026-06-29T09:00:00.000Z',
    detailFields: [],
  };
}

const slot = (notifications: Array<SmartNotification>): SourceSlot => ({
  notifications,
  isLoading: false,
  error: null,
  mutate: vi.fn(),
});

describe('the aggregate store', () => {
  beforeEach(() => {
    _resetAggregate();
    _resetNotificationSources();
  });

  it('reports an empty, still-loading slot for a source that has not reported yet', () => {
    expect(getSourceSlot('never-seen')).toEqual(
      expect.objectContaining({ notifications: [], isLoading: true, error: null }),
    );
  });

  it('hands back what a source published', () => {
    const published = slot([build('one')]);

    publishSourceResult('source-a', published);

    expect(getSourceSlot('source-a')).toBe(published);
  });

  // The bell and the full-page inbox both mount an aggregator; publishing the same value twice must
  // not churn the store and re-render every consumer.
  it('ignores a republish of an identical result', () => {
    const notifications = [build('one')];
    publishSourceResult('source-a', slot(notifications));
    const first = getSourceSlot('source-a');

    publishSourceResult('source-a', { ...first, notifications });

    expect(getSourceSlot('source-a')).toBe(first);
  });

  it('accepts a republish once the notifications actually change', () => {
    publishSourceResult('source-a', slot([build('one')]));
    const first = getSourceSlot('source-a');

    publishSourceResult('source-a', slot([build('one'), build('two')]));

    expect(getSourceSlot('source-a')).not.toBe(first);
    expect(getSourceSlot('source-a').notifications).toHaveLength(2);
  });

  it('drops a slot when its source is retracted', () => {
    publishSourceResult('source-a', slot([build('one')]));

    retractSourceResult('source-a');

    expect(getSourceSlot('source-a').notifications).toEqual([]);
  });

  it('ignores a retraction for a source with no slot', () => {
    expect(() => retractSourceResult('never-seen')).not.toThrow();
  });
});

describe('NotificationAggregator', () => {
  beforeEach(() => {
    _resetAggregate();
    _resetNotificationSources();
  });

  it('renders nothing', () => {
    const { container } = render(<NotificationAggregator />);

    expect(container).toBeEmptyDOMElement();
  });

  it('runs every registered source and publishes what it returns', () => {
    registerNotificationSource({
      id: 'source-a',
      useNotifications: () => slot([build('a-one')]),
    });
    registerNotificationSource({
      id: 'source-b',
      useNotifications: () => ({ ...slot([]), isLoading: true }),
    });

    render(<NotificationAggregator />);

    expect(getSourceSlot('source-a').notifications.map((n) => n.id)).toEqual(['a-one']);
    expect(getSourceSlot('source-b').isLoading).toBe(true);
  });

  // Each source runs inside its own component, so it may use as many hooks as it likes without
  // constraining any other source — and the registry can still grow after mount.
  it('picks up a source registered after it has already mounted', () => {
    const { rerender } = render(<NotificationAggregator />);
    expect(getSourceSlot('source-late').notifications).toEqual([]);

    registerNotificationSource({
      id: 'source-late',
      useNotifications: () => slot([build('late-one')]),
    });
    rerender(<NotificationAggregator />);

    expect(getSourceSlot('source-late').notifications.map((n) => n.id)).toEqual(['late-one']);
  });

  it("retracts a source's notifications when it is unregistered", () => {
    registerNotificationSource({
      id: 'source-a',
      useNotifications: () => slot([build('a-one')]),
    });
    const { rerender } = render(<NotificationAggregator />);

    unregisterNotificationSource('source-a');
    rerender(<NotificationAggregator />);

    expect(getSourceSlot('source-a').notifications).toEqual([]);
  });

  it('clears what a source published when it unmounts', () => {
    registerNotificationSource({
      id: 'source-a',
      useNotifications: () => slot([build('a-one')]),
    });
    const { unmount } = render(<NotificationAggregator />);

    unmount();

    expect(getSourceSlot('source-a').notifications).toEqual([]);
  });
});
