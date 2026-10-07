import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useConfig, useOpenmrsSWR, useSession } from '@openmrs/esm-framework';
import { _resetAggregate, getSourceSlot } from '../core/notification-aggregate';
import NotificationAggregator from '../core/notification-aggregator.component';
import { _resetNotificationSources, getNotificationSources } from '../core/notification-source';
import { _resetOptInStore } from '../core/opt-in-store';
import { registerLabResultsSource, labResultsSourceId } from './lab-results';
import { registerNotificationsBackendSource, notificationsBackendSourceId } from './notifications-backend';

const mockUseConfig = vi.mocked(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockUseOpenmrsSWR = vi.mocked(useOpenmrsSWR);

const config = {
  enabled: true,
  pollingIntervalMs: 30000,
  sources: {
    labResults: {
      enabled: true,
      labOrderTypeUuid: 'lab-order-type',
      notifyOnAbnormalNonCritical: false,
      locationScoped: true,
      notificationWindowDays: 7,
    },
    notificationsBackend: {
      enabled: false,
      minimumPriority: 'LOW',
      notificationTypes: ['LAB_RESULT', 'PRESCRIPTION', 'SAMPLE_REJECTED', 'GENERAL'],
      maxNotifications: 50,
    },
  },
};

/**
 * The registration wiring. What each source *produces* is covered by its own tests; this is about
 * the two of them coexisting in one inbox, which is the point of the source abstraction.
 */
describe('the built-in sources', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAggregate();
    _resetNotificationSources();
    _resetOptInStore();
    mockUseConfig.mockReturnValue(config);
    mockUseSession.mockReturnValue({ user: { uuid: 'user-1' }, sessionLocation: { uuid: 'loc-1' } } as never);
    // The framework's mock calls `key.toString()` unconditionally, so it throws on the null key that
    // means "do not fetch" — which is exactly what a disabled source passes.
    mockUseOpenmrsSWR.mockReturnValue({ data: undefined, error: null, isLoading: false, mutate: vi.fn() } as never);
  });

  it('registers both under stable ids', () => {
    registerLabResultsSource();
    registerNotificationsBackendSource();

    expect(getNotificationSources().map((source) => source.id)).toEqual([
      labResultsSourceId,
      notificationsBackendSourceId,
    ]);
  });

  it('runs both together without either interfering with the other', () => {
    registerLabResultsSource();
    registerNotificationsBackendSource();

    render(<NotificationAggregator />);

    // Both reported a slot, which is what lets the core merge them into one list.
    expect(getSourceSlot(labResultsSourceId).notifications).toEqual([]);
    expect(getSourceSlot(notificationsBackendSourceId).notifications).toEqual([]);
  });

  it('is quiet when the master switch is off, whatever the sources say', () => {
    mockUseConfig.mockReturnValue({ ...config, enabled: false });
    registerLabResultsSource();
    registerNotificationsBackendSource();

    render(<NotificationAggregator />);

    expect(getSourceSlot(labResultsSourceId).notifications).toEqual([]);
    expect(getSourceSlot(notificationsBackendSourceId).notifications).toEqual([]);
  });

  // A distro can drop a whole class of notification without touching the rest of the inbox.
  it('lets one source be disabled while the other keeps running', () => {
    mockUseConfig.mockReturnValue({
      ...config,
      sources: { ...config.sources, labResults: { ...config.sources.labResults, enabled: false } },
    });
    registerLabResultsSource();
    registerNotificationsBackendSource();

    render(<NotificationAggregator />);

    expect(getSourceSlot(labResultsSourceId).isLoading).toBe(false);
  });

  it('replaces rather than duplicates when a source is registered twice', () => {
    registerLabResultsSource();
    registerLabResultsSource();

    expect(getNotificationSources().filter((source) => source.id === labResultsSourceId)).toHaveLength(1);
  });
});
