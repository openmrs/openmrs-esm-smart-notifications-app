import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfig } from '@openmrs/esm-framework';
import { notificationsStore, type SmartNotification } from './notification.resource';
import NotificationBell from './notification-bell.extension';

const mockUseConfig = vi.mocked(useConfig);

const buildNotification = (overrides: Partial<SmartNotification>): SmartNotification => ({
  id: 'id',
  title: 'Title',
  message: 'Message',
  acuity: 'routine',
  category: 'Lab result',
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  read: false,
  ...overrides,
});

describe('NotificationBell', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ badge: { countRoutineNotifications: false, maxCount: 99 } });
    notificationsStore.setState({
      notifications: [
        buildNotification({ id: 'a', acuity: 'stat', title: 'Critical potassium' }),
        buildNotification({ id: 'b', acuity: 'critical', title: 'Allergy alert' }),
        buildNotification({ id: 'c', acuity: 'routine', title: 'Routine result' }),
      ],
    });
  });

  it('renders the bell and shows the unread high-acuity count as a badge', () => {
    render(<NotificationBell />);

    expect(screen.getByRole('button', { name: /unread notifications/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens the panel and lists notifications when clicked', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole('button', { name: /unread notifications/i }));

    expect(screen.getByText('Critical potassium')).toBeInTheDocument();
    expect(screen.getByText('Allergy alert')).toBeInTheDocument();
    expect(screen.getByText('Routine result')).toBeInTheDocument();
  });

  it('decrements the badge when a notification is marked reviewed', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole('button', { name: /unread notifications/i }));
    const [firstReviewButton] = screen.getAllByRole('button', { name: /mark reviewed/i });
    await user.click(firstReviewButton);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('counts routine notifications when configured to do so', () => {
    mockUseConfig.mockReturnValue({ badge: { countRoutineNotifications: true, maxCount: 99 } });
    render(<NotificationBell />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
