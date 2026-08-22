import { describe, expect, it } from 'vitest';
import { mockNormalObservation, mockRoutineOrder, resulted } from '__mocks__';
import { toLabNotification } from './lab-notification-model';
import { toSmartNotification } from './to-smart-notification';

const t = ((key: string, fallback: string, options?: Record<string, unknown>) =>
  String(fallback).replace(/{{\s*(\w+)\s*}}/g, (match, name) =>
    options && name in options ? String(options[name]) : match,
  )) as never;

const optedIn = { notifyOnAbnormalNonCritical: false, optedIn: true };

const labNotification = toLabNotification(mockRoutineOrder, resulted(mockNormalObservation), optedIn);

describe('toSmartNotification', () => {
  it('namespaces the id so two sources can never collide', () => {
    expect(toSmartNotification(labNotification, t).id).toBe('lab-results:order-uuid-1:obs-uuid-normal');
    expect(toSmartNotification(labNotification, t).sourceId).toBe('lab-results');
  });

  it('maps the lab tag onto the shared severity scale', () => {
    expect(toSmartNotification({ ...labNotification, tag: 'CRITICAL' }, t).severity).toBe('critical');
    expect(toSmartNotification({ ...labNotification, tag: 'STAT' }, t).severity).toBe('high');
    // Nothing is coming back until someone acts, so a rejection needs attention too.
    expect(toSmartNotification({ ...labNotification, tag: 'SAMPLE_REJECTED' }, t).severity).toBe('high');
    expect(toSmartNotification({ ...labNotification, tag: 'ROUTINE' }, t).severity).toBe('low');
  });

  it('builds a headline from the test and its value', () => {
    expect(toSmartNotification(labNotification, t).title).toBe('Serum creatinine — 1.1 mg/dL');
  });

  it('falls back to the test name alone when there is no value', () => {
    const withoutValue = { ...labNotification, value: undefined, units: undefined };

    expect(toSmartNotification(withoutValue, t).title).toBe('Serum creatinine');
  });

  it('summarises the interpretation and range underneath', () => {
    expect(toSmartNotification(labNotification, t).subtitle).toBe('Normal · Ref 0.6 – 1.2 mg/dL');
  });

  it('shows the rejection reason instead of a range for a rejected sample', () => {
    const rejected = { ...labNotification, tag: 'SAMPLE_REJECTED' as const, rejectionReason: 'Haemolysed sample' };

    expect(toSmartNotification(rejected, t).subtitle).toBe('Haemolysed sample');
  });

  it('lays the order detail out as labelled fields the generic modal can render', () => {
    const { detailFields } = toSmartNotification(labNotification, t);

    expect(detailFields).toEqual([
      { label: 'Test', value: 'Serum creatinine', secondary: 'Serum chemistry panel' },
      { label: 'Result', value: '1.1 mg/dL', secondary: 'Normal · Ref 0.6 – 1.2 mg/dL' },
      { label: 'Ordering clinician', value: 'Dr. Sarah Smith' },
      { label: 'Location', value: 'Outpatient Triage', secondary: 'Order number ORD-1001' },
    ]);
  });

  it('points "View in chart" at the results dashboard', () => {
    expect(toSmartNotification(labNotification, t).chartPath).toBe('results');
  });

  it('carries the patient so the inbox can navigate and show a header', () => {
    expect(toSmartNotification(labNotification, t).patientUuid).toBe(labNotification.patientUuid);
  });
});
