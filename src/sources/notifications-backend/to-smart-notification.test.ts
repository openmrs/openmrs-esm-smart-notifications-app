import { describe, expect, it } from 'vitest';
import { toSmartNotification } from './index';
import type { Notification } from './types';

const t = (_key: string, fallback: string) => fallback;

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    uuid: 'notification-1',
    display: 'New Serum Potassium result is available. [LAB_RESULT/HIGH]',
    type: 'LAB_RESULT',
    priority: 'HIGH',
    message: 'New Serum Potassium result is available.',
    status: 'UNREAD',
    patient: { uuid: 'patient-1', display: '10001 — Amoit Sarah' },
    recipient: { uuid: 'user-1', display: 'Dr. Sarah Smith' },
    readAt: null,
    reviewedAt: null,
    metadata: '{"obsUuid":"obs-1"}',
    auditInfo: { dateCreated: '2026-07-21T09:00:00.000+0000' },
    ...overrides,
  };
}

describe('toSmartNotification (notifications backend)', () => {
  it('namespaces the id so it cannot collide with another source', () => {
    const mapped = toSmartNotification(buildNotification(), t);

    expect(mapped.id).toBe('notifications-backend:notification-1');
    expect(mapped.sourceId).toBe('notifications-backend');
  });

  it("uses the backend's rendered message as the headline", () => {
    expect(toSmartNotification(buildNotification(), t).title).toBe('New Serum Potassium result is available.');
  });

  it('maps priority onto the shared severity scale and labels it', () => {
    expect(toSmartNotification(buildNotification({ priority: 'HIGH' }), t)).toEqual(
      expect.objectContaining({ severity: 'critical', severityLabel: 'High' }),
    );
    expect(toSmartNotification(buildNotification({ priority: 'MEDIUM' }), t)).toEqual(
      expect.objectContaining({ severity: 'medium', severityLabel: 'Medium' }),
    );
    expect(toSmartNotification(buildNotification({ priority: 'LOW' }), t)).toEqual(
      expect.objectContaining({ severity: 'low', severityLabel: 'Low' }),
    );
  });

  it.each([
    ['LAB_RESULT', 'Lab result'],
    ['PRESCRIPTION', 'Prescription'],
    ['SAMPLE_REJECTED', 'Sample rejected'],
    ['GENERAL', 'General'],
  ] as const)('labels a %s notification', (type, expected) => {
    expect(toSmartNotification(buildNotification({ type }), t).kindLabel).toBe(expected);
  });

  it('lays the patient, recipient and observation reference out as detail fields', () => {
    expect(toSmartNotification(buildNotification(), t).detailFields).toEqual([
      { label: 'Patient', value: '10001 — Amoit Sarah' },
      { label: 'Recipient', value: 'Dr. Sarah Smith' },
      { label: 'Observation reference', value: 'obs-1' },
    ]);
  });

  it('omits a field the backend did not supply rather than showing a placeholder', () => {
    const sparse = buildNotification({ patient: null, recipient: null, metadata: null });

    expect(toSmartNotification(sparse, t).detailFields).toEqual([]);
  });

  it('survives metadata that is not the JSON object it is supposed to be', () => {
    expect(toSmartNotification(buildNotification({ metadata: 'not json' }), t).detailFields).toEqual([
      { label: 'Patient', value: '10001 — Amoit Sarah' },
      { label: 'Recipient', value: 'Dr. Sarah Smith' },
    ]);
  });

  it('carries the patient so the inbox can navigate to their chart', () => {
    expect(toSmartNotification(buildNotification(), t).patientUuid).toBe('patient-1');
  });

  it('falls back to an empty date when audit info was not requested', () => {
    expect(toSmartNotification(buildNotification({ auditInfo: undefined }), t).date).toBe('');
  });
});
