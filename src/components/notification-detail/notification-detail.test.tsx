import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { _resetAggregate } from '../../core/notification-aggregate';
import { _resetNotificationSources, registerNotificationSource } from '../../core/notification-source';
import { _resetReviewStore, getReviewedNotifications, setReviewUser } from '../../core/review-store';
import type { SmartNotification } from '../../core/types';
import NotificationDetailModal from './notification-detail.modal';

const mockNavigate = vi.mocked(navigate);

const notification: SmartNotification = {
  id: 'lab-results:order-1:obs-1',
  sourceId: 'lab-results',
  severity: 'critical',
  severityLabel: 'Critical',
  kindLabel: 'Lab result',
  patientUuid: 'patient-1',
  title: 'Haemoglobin — 4.1 g/dL',
  subtitle: 'Critically low · Ref 12 – 14 g/dL',
  date: '2026-06-29T09:00:00.000Z',
  chartPath: 'results',
  detailFields: [
    { label: 'Test', value: 'Haemoglobin', secondary: 'Full blood count' },
    { label: 'Result', value: '4.1 g/dL', secondary: 'Critically low · Ref 12 – 14 g/dL' },
    { label: 'Ordering clinician', value: 'Dr. Sarah Smith' },
  ],
};

describe('NotificationDetailModal', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetAggregate();
    _resetNotificationSources();
    _resetReviewStore();
  });

  it('renders whatever fields the source supplied, with no knowledge of what they mean', () => {
    render(<NotificationDetailModal closeModal={vi.fn()} notification={notification} />);

    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Haemoglobin')).toBeInTheDocument();
    expect(screen.getByText('Full blood count')).toBeInTheDocument();
    expect(screen.getByText('Ordering clinician')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sarah Smith')).toBeInTheDocument();
  });

  it('shows the severity and kind in the header', () => {
    render(<NotificationDetailModal closeModal={vi.fn()} notification={notification} />);

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText(/Lab result/)).toBeInTheDocument();
  });

  it('records the review and closes when signed off', async () => {
    const user = userEvent.setup();
    const closeModal = vi.fn();
    setReviewUser('user-1');

    render(<NotificationDetailModal closeModal={closeModal} notification={notification} />);
    await user.click(screen.getByRole('button', { name: 'Mark as reviewed' }));

    expect(getReviewedNotifications()).toHaveProperty('lab-results:order-1:obs-1');
    expect(closeModal).toHaveBeenCalled();
  });

  it('mirrors the review to the source that raised it', async () => {
    const user = userEvent.setup();
    const markReviewed = vi.fn().mockResolvedValue(undefined);
    registerNotificationSource({
      id: 'lab-results',
      useNotifications: () => ({ notifications: [], isLoading: false, error: null, mutate: vi.fn() }),
      markReviewed,
    });

    render(<NotificationDetailModal closeModal={vi.fn()} notification={notification} />);
    await user.click(screen.getByRole('button', { name: 'Mark as reviewed' }));

    expect(markReviewed).toHaveBeenCalledWith(
      notification,
      expect.objectContaining({ providerDisplay: expect.any(String) }),
    );
  });

  // Looking is not signing off: the row has to stay in the inbox until it is explicitly reviewed.
  it('navigates to the chart without clearing the notification', async () => {
    const user = userEvent.setup();
    setReviewUser('user-1');

    render(<NotificationDetailModal closeModal={vi.fn()} notification={notification} />);
    await user.click(screen.getByRole('button', { name: 'View in chart' }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-1/chart/results' });
    expect(getReviewedNotifications()).toEqual({});
  });

  it('falls back to the chart root for a source that names no dashboard', async () => {
    const user = userEvent.setup();

    render(<NotificationDetailModal closeModal={vi.fn()} notification={{ ...notification, chartPath: undefined }} />);
    await user.click(screen.getByRole('button', { name: 'View in chart' }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-1/chart' });
  });

  it('disables the chart link for a notification about no particular patient', () => {
    render(<NotificationDetailModal closeModal={vi.fn()} notification={{ ...notification, patientUuid: undefined }} />);

    expect(screen.getByRole('button', { name: 'View in chart' })).toBeDisabled();
  });
});
