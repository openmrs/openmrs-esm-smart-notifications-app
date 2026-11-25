import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showSnackbar } from '@openmrs/esm-framework';
import NotifyWhenResulted from './notify-when-resulted.extension';
import { notifyWhenResultedStore, type LabOrderContext } from './notify-when-resulted.resource';

const mockShowSnackbar = vi.mocked(showSnackbar);

const order: LabOrderContext = {
  testType: { label: 'Haemoglobin', conceptUuid: 'concept-uuid' },
  visit: { patient: { uuid: 'patient-uuid' } },
};

beforeEach(() => {
  notifyWhenResultedStore.setState({ optIns: {} });
});

describe('NotifyWhenResulted', () => {
  it('offers the opt-in switched off, and explains what it does', () => {
    render(<NotifyWhenResulted order={order} />);

    expect(screen.getByRole('switch', { name: /notify me when resulted/i })).not.toBeChecked();
    expect(
      screen.getByText(/turning this on sends you a notification the moment this order is resulted/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Planned for a future release.')).toBeInTheDocument();
  });

  it('records the opt-in and confirms it when switched on', async () => {
    const user = userEvent.setup();
    render(<NotifyWhenResulted order={order} />);

    await user.click(screen.getByRole('switch', { name: /notify me when resulted/i }));

    expect(screen.getByRole('switch', { name: /notify me when resulted/i })).toBeChecked();
    expect(notifyWhenResultedStore.getState().optIns).toEqual({ 'patient-uuid:concept-uuid': true });
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Notify when resulted' }),
    );
  });

  it('withdraws the opt-in without confirming again when switched back off', async () => {
    const user = userEvent.setup();
    render(<NotifyWhenResulted order={order} />);
    const toggle = screen.getByRole('switch', { name: /notify me when resulted/i });

    await user.click(toggle);
    mockShowSnackbar.mockClear();
    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(notifyWhenResultedStore.getState().optIns).toEqual({ 'patient-uuid:concept-uuid': false });
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('reflects an opt-in that was already recorded for this order', () => {
    notifyWhenResultedStore.setState({ optIns: { 'patient-uuid:concept-uuid': true } });

    render(<NotifyWhenResulted order={order} />);

    expect(screen.getByRole('switch', { name: /notify me when resulted/i })).toBeChecked();
  });

  it('does not offer the opt-in for an order it cannot key on', () => {
    render(<NotifyWhenResulted order={{ testType: { label: 'Haemoglobin' } }} />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('does not offer the opt-in when the slot supplies no order', () => {
    render(<NotifyWhenResulted />);

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
