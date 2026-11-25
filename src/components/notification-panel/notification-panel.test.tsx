import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showModal, useConfig } from '@openmrs/esm-framework';
import { _resetAggregate, publishSourceResult } from '../../core/notification-aggregate';
import { _resetNotificationSources } from '../../core/notification-source';
import { _resetPanelControls, setNotificationsPanelClose } from '../../core/panel-controls';
import { _resetReadStore, getReadNotifications, setReadUser } from '../../core/read-store';
import { _resetReviewStore } from '../../core/review-store';
import type { NotificationSeverity, SmartNotification } from '../../core/types';
import NotificationRows from './notification-panel.extension';

const mockUseConfig = vi.mocked(useConfig);
const mockShowModal = vi.mocked(showModal);

function build(id: string, over: Partial<SmartNotification> = {}): SmartNotification {
  return {
    id,
    sourceId: 'lab-results',
    severity: 'critical' as NotificationSeverity,
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

describe('NotificationRows', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAggregate();
    _resetNotificationSources();
    _resetPanelControls();
    _resetReadStore();
    _resetReviewStore();
    mockUseConfig.mockReturnValue({ enabled: true });
  });

  it('renders nothing when the feature is switched off', () => {
    mockUseConfig.mockReturnValue({ enabled: false });
    publish([build('one')]);

    const { container } = render(<NotificationRows />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists what each notification says, whichever source raised it', () => {
    publish([build('one')]);

    render(<NotificationRows />);

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Lab result')).toBeInTheDocument();
    expect(screen.getByText('Haemoglobin — 4.1 g/dL')).toBeInTheDocument();
    expect(screen.getByText('Critically low · Ref 12 – 14 g/dL')).toBeInTheDocument();
  });

  it('interleaves two sources into one list', () => {
    publish([build('lab', { title: 'Haemoglobin — 4.1 g/dL' })]);
    publishSourceResult('notifications-backend', {
      notifications: [
        build('backend', {
          sourceId: 'notifications-backend',
          severity: 'low',
          severityLabel: 'Low',
          kindLabel: 'Prescription',
          title: 'A prescription needs review',
          subtitle: undefined,
        }),
      ],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<NotificationRows />);

    const rows = screen
      .getAllByRole('button')
      .filter((button) => button.textContent?.includes('—') || button.textContent?.includes('prescription'));
    expect(rows[0]).toHaveTextContent('Haemoglobin — 4.1 g/dL');
    expect(rows[1]).toHaveTextContent('A prescription needs review');
  });

  it('says how many need review', () => {
    publish([build('one'), build('two')]);

    render(<NotificationRows />);

    expect(screen.getByText('2 notifications need review')).toBeInTheDocument();
  });

  it('shows a placeholder rather than an empty inbox while loading', () => {
    publish([], { isLoading: true });

    render(<NotificationRows />);

    // Neither the empty state nor an error: the clinician is told nothing yet, not "nothing to do".
    expect(screen.queryByText('Nothing needs your attention')).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load notifications.")).not.toBeInTheDocument();
  });

  it('reports a failure rather than showing an empty inbox', () => {
    publish([], { error: new Error('Network down') });

    render(<NotificationRows />);

    expect(screen.getByText("Couldn't load notifications.")).toBeInTheDocument();
  });

  it('reassures the clinician when there is genuinely nothing to do', () => {
    publish([]);

    render(<NotificationRows />);

    expect(screen.getByText('Nothing needs your attention')).toBeInTheDocument();
  });

  it('marks a notification read and opens the detail modal when a row is picked', async () => {
    const user = userEvent.setup();
    setReadUser('user-1');
    publish([build('one')]);

    render(<NotificationRows />);
    await user.click(screen.getByRole('button', { name: /Haemoglobin/ }));

    expect(getReadNotifications()).toHaveProperty('one');
    expect(mockShowModal).toHaveBeenCalledWith(
      'smart-notification-detail-modal',
      expect.objectContaining({ notification: expect.objectContaining({ id: 'one' }) }),
    );
  });

  it('offers a way out of the panel only while the bell says it is open', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    publish([build('one')]);

    const { rerender } = render(<NotificationRows />);
    expect(screen.queryByRole('button', { name: 'Close notifications' })).not.toBeInTheDocument();

    setNotificationsPanelClose(close);
    rerender(<NotificationRows />);
    await user.click(screen.getByRole('button', { name: 'Close notifications' }));

    expect(close).toHaveBeenCalled();
  });
});
