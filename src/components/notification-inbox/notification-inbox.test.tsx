import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showModal } from '@openmrs/esm-framework';
import { _resetAggregate, publishSourceResult } from '../../core/notification-aggregate';
import { _resetNotificationSources } from '../../core/notification-source';
import { _resetReadStore, getReadNotifications } from '../../core/read-store';
import { _resetReviewStore } from '../../core/review-store';
import type { SmartNotification } from '../../core/types';
import NotificationInbox from './notification-inbox.component';

const mockShowModal = vi.mocked(showModal);

function build(id: string, over: Partial<SmartNotification> = {}): SmartNotification {
  return {
    id,
    sourceId: 'lab-results',
    severity: 'critical',
    severityLabel: 'Critical',
    kindLabel: 'Lab result',
    title: 'Haemoglobin — 4.1 g/dL',
    subtitle: 'Critically low · Ref 12 – 14 g/dL',
    date: '2026-06-29T09:00:00.000Z',
    detailFields: [],
    ...over,
  };
}

function publish(notifications: Array<SmartNotification>, over: Partial<{ isLoading: boolean; error: Error }> = {}) {
  publishSourceResult('lab-results', {
    notifications,
    isLoading: over.isLoading ?? false,
    error: over.error ?? null,
    mutate: vi.fn(),
  });
}

describe('NotificationInbox', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAggregate();
    _resetNotificationSources();
    _resetReadStore();
    _resetReviewStore();
  });

  it('lists the same notifications the header panel shows', () => {
    publish([build('one')]);

    render(<NotificationInbox />);

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Haemoglobin — 4.1 g/dL')).toBeInTheDocument();
    expect(screen.getByText('Critically low · Ref 12 – 14 g/dL')).toBeInTheDocument();
  });

  it('shows how many are unread', () => {
    publish([build('one'), build('two')]);

    render(<NotificationInbox />);

    expect(screen.getByText('2 unread')).toBeInTheDocument();
  });

  it('reports a failure rather than an empty inbox', () => {
    publish([], { error: new Error('Network down') });

    render(<NotificationInbox />);

    expect(screen.getByText("Couldn't load notifications.")).toBeInTheDocument();
  });

  it('reassures the clinician when there is genuinely nothing to do', () => {
    publish([]);

    render(<NotificationInbox />);

    expect(screen.getByText('Nothing needs your attention')).toBeInTheDocument();
  });

  it('opens the same detail modal the panel does', async () => {
    const user = userEvent.setup();
    publish([build('one')]);

    render(<NotificationInbox />);
    await user.click(screen.getByRole('button', { name: /Haemoglobin/ }));

    expect(getReadNotifications()).toHaveProperty('one');
    expect(mockShowModal).toHaveBeenCalledWith(
      'smart-notification-detail-modal',
      expect.objectContaining({ notification: expect.objectContaining({ id: 'one' }) }),
    );
  });
});
