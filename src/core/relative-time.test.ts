import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './relative-time';

const t = ((key: string, fallback: string, options?: Record<string, unknown>) =>
  String(fallback).replace(/{{\s*(\w+)\s*}}/g, (match, name) =>
    options && name in options ? String(options[name]) : match,
  )) as never;

const now = new Date('2026-06-29T12:00:00.000Z');
const minutesBefore = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says "Just now" for something under a minute old', () => {
    expect(formatRelativeTime(minutesBefore(0.5), t)).toBe('Just now');
  });

  it('counts minutes up to the hour', () => {
    expect(formatRelativeTime(minutesBefore(12), t)).toBe('12 min ago');
    expect(formatRelativeTime(minutesBefore(59), t)).toBe('59 min ago');
  });

  it('counts hours up to the day', () => {
    expect(formatRelativeTime(minutesBefore(60 * 3), t)).toBe('3 h ago');
  });

  it('counts days up to a week', () => {
    expect(formatRelativeTime(minutesBefore(60 * 24 * 2), t)).toBe('2 d ago');
  });

  // "N d ago" stops being useful past a week, so it falls back to an absolute datetime.
  it('gives an absolute datetime beyond a week', () => {
    const result = formatRelativeTime(minutesBefore(60 * 24 * 10), t);

    expect(result).not.toMatch(/ago/);
    expect(result).toMatch(/2026/);
  });

  it('renders nothing for a missing date', () => {
    expect(formatRelativeTime(undefined, t)).toBe('');
  });
});
