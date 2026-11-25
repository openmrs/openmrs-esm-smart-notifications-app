import { describe, expect, it } from 'vitest';
import {
  byMostRecent,
  getNotificationDate,
  isActionable,
  isUnread,
  meetsMinimumPriority,
  parseNotificationMetadata,
  priorityLabel,
  priorityRank,
  prioritySeverity,
  selectInboxNotifications,
  typeLabel,
} from './notification-display';
import {
  type Notification,
  type NotificationPriority,
  type NotificationStatus,
  type NotificationType,
  notificationTypes,
} from './types';

const t = (_key: string, fallback: string) => fallback;

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    uuid: 'notification-1',
    display: 'New Serum Potassium result is available. [LAB_RESULT/HIGH]',
    type: 'LAB_RESULT',
    priority: 'HIGH',
    message: 'New Serum Potassium result is available.',
    status: 'UNREAD',
    patient: { uuid: 'patient-1', display: 'John Doe' },
    recipient: { uuid: 'user-1', display: 'Dr Jane' },
    readAt: null,
    reviewedAt: null,
    metadata: '{"obsUuid":"obs-1"}',
    voided: false,
    auditInfo: { dateCreated: '2026-07-20T10:00:00.000+0000' },
    ...overrides,
  };
}

describe('parseNotificationMetadata', () => {
  it('parses the JSON the backend writes', () => {
    expect(parseNotificationMetadata('{"obsUuid":"obs-1"}')).toEqual({ obsUuid: 'obs-1' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['malformed JSON', '{not json'],
    ['a JSON array', '["obs-1"]'],
    ['a JSON scalar', '"obs-1"'],
  ])('returns an empty object for %s', (_label, raw) => {
    expect(parseNotificationMetadata(raw as string | null | undefined)).toEqual({});
  });
});

describe('getNotificationDate', () => {
  it('reads the creation date from the audit info', () => {
    expect(getNotificationDate(buildNotification())).toBe('2026-07-20T10:00:00.000+0000');
  });

  it('returns null when audit info was not requested', () => {
    expect(getNotificationDate(buildNotification({ auditInfo: undefined }))).toBeNull();
  });
});

describe('isActionable', () => {
  it.each<[NotificationStatus, boolean]>([
    ['UNREAD', true],
    ['READ', true],
    ['REVIEWED', false],
    ['ARCHIVED', false],
  ])('treats %s as actionable=%s', (status, expected) => {
    expect(isActionable(buildNotification({ status }))).toBe(expected);
  });

  it('never treats a voided notification as actionable', () => {
    expect(isActionable(buildNotification({ status: 'UNREAD', voided: true }))).toBe(false);
  });
});

describe('isUnread', () => {
  it('is true only for unread, non-voided notifications', () => {
    expect(isUnread(buildNotification({ status: 'UNREAD' }))).toBe(true);
    expect(isUnread(buildNotification({ status: 'READ' }))).toBe(false);
    expect(isUnread(buildNotification({ status: 'UNREAD', voided: true }))).toBe(false);
  });
});

describe('priority helpers', () => {
  it('ranks priorities from low to high', () => {
    expect(priorityRank('LOW')).toBe(0);
    expect(priorityRank('MEDIUM')).toBe(1);
    expect(priorityRank('HIGH')).toBe(2);
  });

  it('falls back to the lowest rank for an unrecognised priority', () => {
    expect(priorityRank('URGENT' as NotificationPriority)).toBe(0);
  });

  it('compares against the configured minimum', () => {
    expect(meetsMinimumPriority(buildNotification({ priority: 'LOW' }), 'MEDIUM')).toBe(false);
    expect(meetsMinimumPriority(buildNotification({ priority: 'MEDIUM' }), 'MEDIUM')).toBe(true);
    expect(meetsMinimumPriority(buildNotification({ priority: 'HIGH' }), 'MEDIUM')).toBe(true);
  });

  // HIGH is this source's top tier, so it maps to the shared scale's top tier. Anything lower would
  // sort a genuinely critical backend notification underneath a locally derived one.
  it('maps its priorities onto the shared severity scale', () => {
    expect(prioritySeverity('HIGH')).toBe('critical');
    expect(prioritySeverity('MEDIUM')).toBe('medium');
    expect(prioritySeverity('LOW')).toBe('low');
  });

  it('labels each priority', () => {
    expect(priorityLabel('HIGH', t)).toBe('High');
    expect(priorityLabel('MEDIUM', t)).toBe('Medium');
    expect(priorityLabel('LOW', t)).toBe('Low');
  });
});

describe('typeLabel', () => {
  it.each<[NotificationType, string]>([
    ['LAB_RESULT', 'Lab result'],
    ['PRESCRIPTION', 'Prescription'],
    ['SAMPLE_REJECTED', 'Sample rejected'],
    ['GENERAL', 'General'],
  ])('labels %s', (type, expected) => {
    expect(typeLabel(type, t)).toBe(expected);
  });
});

describe('byMostRecent', () => {
  const older = buildNotification({ auditInfo: { dateCreated: '2026-07-20T10:00:00.000+0000' } });
  const newer = buildNotification({ auditInfo: { dateCreated: '2026-07-21T10:00:00.000+0000' } });
  const undated = buildNotification({ auditInfo: undefined });

  it('sorts newer notifications first', () => {
    expect([older, newer].sort(byMostRecent)).toEqual([newer, older]);
  });

  it('sorts undated notifications last regardless of input order', () => {
    expect([undated, newer].sort(byMostRecent)).toEqual([newer, undated]);
    expect([newer, undated].sort(byMostRecent)).toEqual([newer, undated]);
  });

  it('treats two undated notifications as equal', () => {
    expect(byMostRecent(undated, undated)).toBe(0);
  });
});

describe('selectInboxNotifications', () => {
  const options = { minimumPriority: 'LOW' as NotificationPriority, types: notificationTypes };

  it('keeps only actionable notifications, most recent first', () => {
    const unread = buildNotification({
      uuid: 'unread',
      status: 'UNREAD',
      auditInfo: { dateCreated: '2026-07-21T10:00:00.000+0000' },
    });
    const read = buildNotification({
      uuid: 'read',
      status: 'READ',
      auditInfo: { dateCreated: '2026-07-22T10:00:00.000+0000' },
    });
    const reviewed = buildNotification({ uuid: 'reviewed', status: 'REVIEWED' });

    expect(selectInboxNotifications([unread, read, reviewed], options).map((n) => n.uuid)).toEqual(['read', 'unread']);
  });

  it('drops notifications below the minimum priority', () => {
    const low = buildNotification({ uuid: 'low', priority: 'LOW' });
    const high = buildNotification({ uuid: 'high', priority: 'HIGH' });

    expect(selectInboxNotifications([low, high], { ...options, minimumPriority: 'HIGH' }).map((n) => n.uuid)).toEqual([
      'high',
    ]);
  });

  it('drops notification types that are not configured for display', () => {
    const lab = buildNotification({ uuid: 'lab', type: 'LAB_RESULT' });
    const general = buildNotification({ uuid: 'general', type: 'GENERAL' });

    expect(selectInboxNotifications([lab, general], { ...options, types: ['LAB_RESULT'] }).map((n) => n.uuid)).toEqual([
      'lab',
    ]);
  });

  it('returns an empty list when nothing qualifies', () => {
    expect(selectInboxNotifications([], options)).toEqual([]);
  });
});
