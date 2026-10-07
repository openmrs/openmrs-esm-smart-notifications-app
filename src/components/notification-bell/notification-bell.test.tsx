import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfig } from '@openmrs/esm-framework';
import { _resetAggregate, publishSourceResult } from '../../core/notification-aggregate';
import { _resetNotificationSources } from '../../core/notification-source';
import { _resetReadStore, setReadUser } from '../../core/read-store';
import { _resetReviewStore } from '../../core/review-store';
import { _resetPanelControls } from '../../core/panel-controls';
import type { SmartNotification } from '../../core/types';
import NotificationBell from './notification-bell.extension';

const mockUseConfig = vi.mocked(useConfig);

function build(id: string): SmartNotification {
  return {
    id,
    sourceId: 'source-a',
    severity: 'critical',
    severityLabel: 'Critical',
    kindLabel: 'Lab result',
    title: id,
    date: '2026-06-29T09:00:00.000Z',
    detailFields: [],
  };
}

function publish(notifications: Array<SmartNotification>) {
  publishSourceResult('source-a', { notifications, isLoading: false, error: null, mutate: vi.fn() });
}

const panelProps = (isOpen = false) => ({
  isActivePanel: vi.fn().mockReturnValue(isOpen),
  togglePanel: vi.fn(),
});

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAggregate();
    _resetNotificationSources();
    _resetReadStore();
    _resetReviewStore();
    _resetPanelControls();
    mockUseConfig.mockReturnValue({ enabled: true });
  });

  it('renders nothing when the feature is switched off', () => {
    mockUseConfig.mockReturnValue({ enabled: false });
    publish([build('one')]);

    const { container } = render(<NotificationBell {...panelProps()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the unread count on the bell', () => {
    publish([build('one'), build('two')]);

    render(<NotificationBell {...panelProps()} />);

    expect(screen.getByRole('button', { name: '2 unread notifications' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('caps a large count rather than overflowing the badge', () => {
    publish(Array.from({ length: 12 }, (_, index) => build(`n-${index}`)));

    render(<NotificationBell {...panelProps()} />);

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('drops the badge once everything has been read', () => {
    setReadUser('user-1');
    publish([build('one')]);
    localStorage.setItem(
      'openmrs:smart-notifications:read:user-1',
      JSON.stringify({ one: '2026-06-29T09:00:00.000Z' }),
    );
    _resetReadStore();
    setReadUser('user-1');

    render(<NotificationBell {...panelProps()} />);

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('asks the shell to open its notifications panel when clicked', async () => {
    const user = userEvent.setup();
    const props = panelProps();
    publish([build('one')]);

    render(<NotificationBell {...props} />);
    await user.click(screen.getByRole('button', { name: '1 unread notifications' }));

    expect(props.togglePanel).toHaveBeenCalledWith('notificationsMenu');
  });

  it('reports the panel state to assistive technology', () => {
    publish([]);

    render(<NotificationBell {...panelProps(true)} />);

    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-expanded', 'true');
  });
});
