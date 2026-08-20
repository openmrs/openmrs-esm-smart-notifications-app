import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getOptInKey,
  notifyWhenResultedStore,
  useNotifyWhenResulted,
  type LabOrderContext,
} from './notify-when-resulted.resource';

const savedOrder: LabOrderContext = {
  uuid: 'order-uuid',
  testType: { label: 'Haemoglobin', conceptUuid: 'concept-uuid' },
  visit: { patient: { uuid: 'patient-uuid' } },
};

const basketOrder: LabOrderContext = {
  testType: { label: 'Haemoglobin', conceptUuid: 'concept-uuid' },
};

beforeEach(() => {
  notifyWhenResultedStore.setState({ optIns: {} });
});

describe('getOptInKey', () => {
  it('returns null when there is no order', () => {
    expect(getOptInKey(undefined)).toBeNull();
  });

  it('returns null when the order carries nothing identifying', () => {
    expect(getOptInKey({ testType: { label: 'Haemoglobin' } })).toBeNull();
  });

  it('falls back to the ordered concept while the order is still in the basket', () => {
    expect(getOptInKey(basketOrder)).toBe('concept-uuid');
  });

  it('prefers the order UUID once the order has been saved', () => {
    expect(getOptInKey({ ...savedOrder, visit: undefined })).toBe('order-uuid');
  });

  it('scopes the key to the patient when the order has a visit', () => {
    expect(getOptInKey(savedOrder)).toBe('patient-uuid:order-uuid');
  });

  it('keeps the same test ordered for two patients on separate keys', () => {
    const forPatientA = getOptInKey({ ...basketOrder, visit: { patient: { uuid: 'patient-a' } } });
    const forPatientB = getOptInKey({ ...basketOrder, visit: { patient: { uuid: 'patient-b' } } });

    expect(forPatientA).not.toBe(forPatientB);
  });
});

describe('useNotifyWhenResulted', () => {
  it('starts out not opted in', () => {
    const { result } = renderHook(() => useNotifyWhenResulted(savedOrder));

    expect(result.current.isOptedIn).toBe(false);
    expect(result.current.canOptIn).toBe(true);
  });

  it('records an opt-in and reads it back', () => {
    const { result } = renderHook(() => useNotifyWhenResulted(savedOrder));

    act(() => result.current.setOptedIn(true));

    expect(result.current.isOptedIn).toBe(true);
    expect(notifyWhenResultedStore.getState().optIns).toEqual({ 'patient-uuid:order-uuid': true });
  });

  it('clears an opt-in again', () => {
    const { result } = renderHook(() => useNotifyWhenResulted(savedOrder));

    act(() => result.current.setOptedIn(true));
    act(() => result.current.setOptedIn(false));

    expect(result.current.isOptedIn).toBe(false);
  });

  it('leaves opt-ins for other orders untouched', () => {
    const { result } = renderHook(() => useNotifyWhenResulted(basketOrder));

    notifyWhenResultedStore.setState({ optIns: { 'someone-elses-order': true } });
    act(() => result.current.setOptedIn(true));

    expect(notifyWhenResultedStore.getState().optIns).toEqual({
      'someone-elses-order': true,
      'concept-uuid': true,
    });
  });

  it('reports that it cannot opt in, and records nothing, for an unkeyable order', () => {
    const { result } = renderHook(() => useNotifyWhenResulted({}));

    expect(result.current.canOptIn).toBe(false);
    expect(result.current.isOptedIn).toBe(false);

    act(() => result.current.setOptedIn(true));

    expect(notifyWhenResultedStore.getState().optIns).toEqual({});
  });
});
