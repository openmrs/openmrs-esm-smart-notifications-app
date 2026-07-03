import { beforeEach, describe, expect, it } from 'vitest';
import {
  addNotification,
  markAllNotificationsReviewed,
  markNotificationReviewed,
  notificationsStore,
  sortNotifications,
  type SmartNotification,
} from './notification.resource';

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

describe('notification.resource', () => {
  beforeEach(() => {
    notificationsStore.setState({ notifications: [] });
  });

  it('adds a notification to the top of the inbox', () => {
    addNotification(buildNotification({ id: 'a' }));
    addNotification(buildNotification({ id: 'b' }));

    const { notifications } = notificationsStore.getState();
    expect(notifications.map((n) => n.id)).toEqual(['b', 'a']);
    expect(notifications[0].read).toBe(false);
  });

  it('does not add duplicate notifications with the same id', () => {
    addNotification(buildNotification({ id: 'a' }));
    addNotification(buildNotification({ id: 'a', title: 'Changed' }));

    const { notifications } = notificationsStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Title');
  });

  it('marks a single notification as reviewed with reviewer and timestamp', () => {
    addNotification(buildNotification({ id: 'a', acuity: 'critical' }));

    markNotificationReviewed('a', 'Dr. Jane');

    const reviewed = notificationsStore.getState().notifications[0];
    expect(reviewed.read).toBe(true);
    expect(reviewed.reviewedBy).toBe('Dr. Jane');
    expect(reviewed.reviewedAt).toBeDefined();
  });

  it('marks all unread notifications as reviewed', () => {
    addNotification(buildNotification({ id: 'a', acuity: 'critical' }));
    addNotification(buildNotification({ id: 'b', acuity: 'stat' }));

    markAllNotificationsReviewed('Dr. Jane');

    expect(notificationsStore.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it('sorts notifications by acuity (STAT, critical, routine) then by recency', () => {
    const notifications: Array<SmartNotification> = [
      buildNotification({ id: 'routine', acuity: 'routine', createdAt: '2024-01-01T10:00:00.000Z' }),
      buildNotification({ id: 'critical-old', acuity: 'critical', createdAt: '2024-01-01T09:00:00.000Z' }),
      buildNotification({ id: 'critical-new', acuity: 'critical', createdAt: '2024-01-01T11:00:00.000Z' }),
      buildNotification({ id: 'stat', acuity: 'stat', createdAt: '2024-01-01T08:00:00.000Z' }),
    ];

    const sorted = sortNotifications(notifications);

    expect(sorted.map((n) => n.id)).toEqual(['stat', 'critical-new', 'critical-old', 'routine']);
  });
});
