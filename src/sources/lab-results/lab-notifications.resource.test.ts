import { describe, expect, it } from 'vitest';
import {
  mockCriticalObservation,
  mockDeclinedOrder,
  mockFhirObservationBundle,
  mockNormalObservation,
  mockRoutineOrder,
  mockSmartNotificationsEncounterUuid,
  mockStatOrder,
} from '__mocks__';
import { type LabOrder, type ResultedObservation, toLabNotification } from './lab-notification-model';
import { assessObservation, type ReferenceRanges } from './reference-ranges';
import {
  isWithinNotificationWindow,
  joinObservationsToOrders,
  notificationWindowStart,
  toRawObservation,
} from './lab-notifications.resource';

describe('toRawObservation', () => {
  it('maps a FHIR Observation onto the shape the notification rule consumes', () => {
    const resource = mockFhirObservationBundle.entry[0].resource;

    expect(toRawObservation(resource as never)).toEqual(
      expect.objectContaining({
        uuid: 'obs-uuid-normal',
        conceptUuid: 'concept-creatinine',
        display: 'Serum creatinine',
        value: '1.1',
        effectiveDateTime: '2026-06-29T09:30:00.000+0000',
        encounterUuid: mockSmartNotificationsEncounterUuid,
        assessmentInput: expect.objectContaining({
          units: 'mg/dL',
          observationRanges: expect.objectContaining({ lowNormal: 0.6, hiNormal: 1.2 }),
        }),
      }),
    );
  });

  it('carries no observation ranges when the resource reports none, so the concept ranges apply', () => {
    const resource = { ...mockFhirObservationBundle.entry[0].resource, referenceRange: [] };

    const raw = toRawObservation(resource as never);

    expect(raw.assessmentInput.observationRanges).toBeUndefined();
    // With nothing on the observation, the assessor falls through to the dictionary's ranges. The
    // value is 1.1, so a normal band starting at 2 must read LOW — proving the concept ranges were
    // the ones applied rather than the observation's own.
    expect(assessObservation(raw.assessmentInput, { lowNormal: 2, hiNormal: 5, units: 'mg/dL' })).toEqual(
      expect.objectContaining({ interpretation: 'LOW', referenceRangeText: '2 – 5 mg/dL', isAbnormal: true }),
    );
  });
});

describe('joinObservationsToOrders', () => {
  const normal = { ...mockNormalObservation, encounterUuid: mockSmartNotificationsEncounterUuid };
  const critical = { ...mockCriticalObservation, encounterUuid: mockSmartNotificationsEncounterUuid };

  it('pairs each order with the observation for the same concept and encounter', () => {
    const joined = joinObservationsToOrders([mockRoutineOrder, mockStatOrder], [normal, critical]);

    expect(joined[0].obs?.uuid).toBe('obs-uuid-normal');
    expect(joined[1].obs?.uuid).toBe('obs-uuid-critical');
  });

  it('leaves an order unpaired when no observation matches its concept', () => {
    const joined = joinObservationsToOrders([mockDeclinedOrder], [normal]);

    expect(joined[0].obs).toBeUndefined();
  });

  it('prefers the observation from the same encounter over an older one for the same concept', () => {
    const fromAnotherEncounter = {
      ...mockNormalObservation,
      uuid: 'obs-uuid-other-encounter',
      encounterUuid: 'encounter-uuid-2',
      effectiveDateTime: '2026-06-30T09:30:00.000+0000',
    };

    const joined = joinObservationsToOrders([mockRoutineOrder], [fromAnotherEncounter, normal]);

    expect(joined[0].obs?.uuid).toBe('obs-uuid-normal');
  });

  it('takes the first result recorded after the order when no encounter matches', () => {
    // The earliest result at or after the order is the one that order produced; a later result for
    // the same concept belongs to whatever was ordered next.
    const first = { ...mockNormalObservation, uuid: 'first', encounterUuid: 'encounter-uuid-3' };
    const later = {
      ...mockNormalObservation,
      uuid: 'later',
      encounterUuid: 'encounter-uuid-4',
      effectiveDateTime: '2026-06-30T09:30:00.000+0000',
    };

    const joined = joinObservationsToOrders([mockRoutineOrder], [later, first]);

    expect(joined[0].obs?.uuid).toBe('first');
  });

  it('leaves an order unpaired when every result for the concept predates it', () => {
    const stale = {
      ...mockNormalObservation,
      uuid: 'stale',
      encounterUuid: 'encounter-uuid-old',
      effectiveDateTime: '2026-05-01T09:30:00.000+0000',
    };

    const joined = joinObservationsToOrders([mockRoutineOrder], [stale]);

    expect(joined[0].obs).toBeUndefined();
  });
});

const glucoseRanges: ReferenceRanges = {
  lowNormal: 4,
  hiNormal: 7,
  lowCritical: 2,
  hiCritical: 25,
  units: 'mmol/L',
};

function labOrder(over: Partial<LabOrder> = {}): LabOrder {
  return {
    uuid: 'order-glucose',
    concept: { uuid: 'concept-glucose', display: 'Serum glucose' },
    encounter: { uuid: 'encounter-today', location: { uuid: 'loc-1', display: 'Outpatient' } },
    orderNumber: 'ORD-9001',
    orderer: { display: 'Dr. Sarah Smith' },
    patient: { uuid: 'patient-1' },
    dateActivated: '2026-06-29T09:00:00.000+0000',
    display: 'Serum glucose',
    urgency: 'ROUTINE',
    fulfillerStatus: 'COMPLETED',
    ...over,
  };
}

function glucoseResult(
  over: Partial<{ uuid: string; value: string; effectiveDateTime: string; encounterUuid: string }> = {},
) {
  const {
    uuid = 'obs-glucose',
    value = '5',
    effectiveDateTime = '2026-06-29T09:30:00.000+0000',
    encounterUuid = 'encounter-today',
  } = over;

  return {
    uuid,
    conceptUuid: 'concept-glucose',
    display: 'Serum glucose',
    value,
    effectiveDateTime,
    encounterUuid,
    assessment: assessObservation({ conceptUuid: 'concept-glucose', value, units: 'mmol/L' }, glucoseRanges),
  } satisfies ResultedObservation & { encounterUuid: string };
}

/**
 * Guards the rule the whole feature rests on: a lab order notifies only when the clinician opted
 * in, when it was ordered STAT, when the value is critical, or when the sample was rejected.
 * Anything else files silently.
 */
describe('what actually reaches the bell', () => {
  function derive(orders: Array<LabOrder>, observations: Array<ReturnType<typeof glucoseResult>>, optedIn = false) {
    return joinObservationsToOrders(orders, observations)
      .map(({ order, obs }) => toLabNotification(order, obs, { notifyOnAbnormalNonCritical: false, optedIn }))
      .filter(Boolean);
  }

  it('stays silent for a routine order the clinician did not opt into', () => {
    expect(derive([labOrder()], [glucoseResult()])).toEqual([]);
  });

  it('notifies for a routine order the clinician opted into', () => {
    expect(derive([labOrder()], [glucoseResult()], true)).toEqual([expect.objectContaining({ tag: 'ROUTINE' })]);
  });

  it('notifies for a STAT order once it has a result', () => {
    expect(derive([labOrder({ urgency: 'STAT' })], [glucoseResult()])).toEqual([
      expect.objectContaining({ tag: 'STAT' }),
    ]);
  });

  it('stays silent for a STAT order that has not been resulted yet', () => {
    expect(derive([labOrder({ urgency: 'STAT' })], [])).toEqual([]);
  });

  it('does not let a result from a previous encounter light up a brand-new order', () => {
    // The regression that made every order notify: a fresh order inheriting last month's result.
    const staleResult = glucoseResult({
      uuid: 'obs-last-month',
      effectiveDateTime: '2026-05-01T09:00:00.000+0000',
      encounterUuid: 'encounter-last-month',
    });

    expect(derive([labOrder({ urgency: 'STAT' })], [staleResult])).toEqual([]);
    expect(derive([labOrder()], [staleResult], true)).toEqual([]);
  });

  it('gives one result to one order when the same test is ordered twice', () => {
    const older = labOrder({ uuid: 'order-first', dateActivated: '2026-06-28T09:00:00.000+0000' });
    const newer = labOrder({ uuid: 'order-second' });

    const joined = joinObservationsToOrders([older, newer], [glucoseResult()]);

    expect(joined.find((entry) => entry.order.uuid === 'order-second')?.obs?.uuid).toBe('obs-glucose');
    expect(joined.find((entry) => entry.order.uuid === 'order-first')?.obs).toBeUndefined();
  });

  it('still notifies for a critical value on a routine, non-opted-in order', () => {
    // Patient safety overrides the filter, and is not configurable off.
    expect(derive([labOrder()], [glucoseResult({ value: '30' })])).toEqual([
      expect.objectContaining({ tag: 'CRITICAL' }),
    ]);
  });

  it('still notifies when the sample was rejected, with no result at all', () => {
    expect(derive([labOrder({ fulfillerStatus: 'DECLINED' })], [])).toEqual([
      expect.objectContaining({ tag: 'SAMPLE_REJECTED' }),
    ]);
  });
});

describe('the notification window', () => {
  const now = Date.parse('2026-06-30T09:00:00.000+0000');
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  it('keeps a result from inside the window', () => {
    expect(isWithinNotificationWindow(daysAgo(2), notificationWindowStart(7, now))).toBe(true);
  });

  it('drops a result from before the window', () => {
    const windowStart = notificationWindowStart(7, now);

    // The backlog case: a long-settled order still sitting in the newest page of lab history.
    expect(isWithinNotificationWindow(daysAgo(400), windowStart)).toBe(false);
    expect(isWithinNotificationWindow(daysAgo(8), windowStart)).toBe(false);
  });

  it('keeps everything when the bound is disabled with 0', () => {
    const windowStart = notificationWindowStart(0, now);

    expect(windowStart).toBeUndefined();
    expect(isWithinNotificationWindow(daysAgo(400), windowStart)).toBe(true);
  });

  it('keeps a notification that carries no usable date rather than hiding it', () => {
    const windowStart = notificationWindowStart(7, now);

    expect(isWithinNotificationWindow(undefined, windowStart)).toBe(true);
    expect(isWithinNotificationWindow('not-a-date', windowStart)).toBe(true);
  });

  it('judges a slow-turnaround test on when it resulted, not when it was ordered', () => {
    // Ordered three weeks ago, resulted this morning: exactly what the bell is for.
    const order = labOrder({ urgency: 'STAT', dateActivated: daysAgo(21) });
    const notification = toLabNotification(order, glucoseResult({ effectiveDateTime: daysAgo(0) }), {
      notifyOnAbnormalNonCritical: false,
      optedIn: false,
    });

    expect(notification?.tag).toBe('STAT');
    expect(isWithinNotificationWindow(notification?.resultDate, notificationWindowStart(7, now))).toBe(true);
  });

  it('drops an old rejection, which has no result date of its own', () => {
    const order = labOrder({ fulfillerStatus: 'DECLINED', dateActivated: daysAgo(90) });
    const notification = toLabNotification(order, undefined, {
      notifyOnAbnormalNonCritical: false,
      optedIn: false,
    });

    expect(notification?.tag).toBe('SAMPLE_REJECTED');
    expect(isWithinNotificationWindow(notification?.resultDate, notificationWindowStart(7, now))).toBe(false);
  });
});
