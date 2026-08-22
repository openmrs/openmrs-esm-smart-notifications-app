import { useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, fhirBaseUrl, openmrsFetch, restBaseUrl, useSession } from '@openmrs/esm-framework';
import { optInKey } from '../../core/constants';
import { optInCoversOrder, useOptIns } from '../../core/opt-in-store';
import {
  extractObservationInterpretation,
  extractObservationReferenceRanges,
  type FhirObservationBundle,
  type FhirObservationResource,
  observationValue,
  referenceId,
} from './fhir-observation';
import {
  type LabNotification,
  type LabOrder,
  type ResultedObservation,
  sortLabNotifications,
  toLabNotification,
} from './lab-notification-model';
import { careSettingUuid, useReferenceRangeAssessor, type ObservationAssessmentInput } from './reference-ranges';

interface OrderFetchResponse {
  results: Array<LabOrder>;
}

/** Config this source needs, supplied by the app's `sources.labResults` block. */
export interface LabSourceConfig {
  enabled: boolean;
  labOrderTypeUuid: string;
  notifyOnAbnormalNonCritical: boolean;
  locationScoped: boolean;
  notificationWindowDays: number;
  pollingIntervalMs: number;
}

/** What each observation contributes before it is assessed. */
type RawObservation = Omit<ResultedObservation, 'assessment'> & {
  encounterUuid?: string;
  assessmentInput: ObservationAssessmentInput;
};

export function toRawObservation(resource: FhirObservationResource): RawObservation {
  const { value, units } = observationValue(resource);

  return {
    uuid: resource.id,
    conceptUuid: resource.code?.coding?.[0]?.code,
    display: resource.code?.text ?? resource.code?.coding?.[0]?.display,
    value,
    effectiveDateTime: resource.effectiveDateTime ?? resource.issued,
    encounterUuid: referenceId(resource.encounter?.reference),
    assessmentInput: {
      conceptUuid: resource.code?.coding?.[0]?.code,
      value,
      units,
      observationRanges: extractObservationReferenceRanges(resource),
      interpretation: extractObservationInterpretation(resource),
    },
  };
}

/**
 * Pairs each order with the result it produced.
 *
 * FHIR lab observations carry no `basedOn` pointing back at the order, so the join is heuristic.
 * Two rules keep it honest, because a wrong pairing means a notification for an order that was
 * never resulted:
 *
 * 1. A result must plausibly belong to the order — either recorded in the same encounter, or
 *    timestamped at/after the order was placed. Without this, a fresh order inherits an old result
 *    for the same concept and notifies straight away, before the lab has done anything.
 * 2. A result is claimed by at most one order, newest order first, so re-ordering the same test
 *    doesn't make one result light up every past order for that concept.
 *
 * Orders with no result yet are returned unpaired, which is what makes a pending order silent.
 */
export function joinObservationsToOrders<
  T extends { uuid: string; conceptUuid?: string; encounterUuid?: string; effectiveDateTime?: string },
>(orders: Array<LabOrder>, observations: Array<T>): Array<{ order: LabOrder; obs: T | undefined }> {
  const byConcept = new Map<string, Array<T>>();
  for (const obs of observations) {
    if (!obs.conceptUuid) {
      continue;
    }
    const bucket = byConcept.get(obs.conceptUuid) ?? [];
    bucket.push(obs);
    byConcept.set(obs.conceptUuid, bucket);
  }

  const claimed = new Set<string>();

  // Newest order first, so the most recent order gets first claim on the most recent result.
  const newestFirst = [...orders].sort((a, b) => (b.dateActivated ?? '').localeCompare(a.dateActivated ?? ''));

  const matches = new Map<string, T | undefined>();

  for (const order of newestFirst) {
    const candidates = (byConcept.get(order.concept?.uuid) ?? []).filter((obs) => !claimed.has(obs.uuid));

    const sameEncounter = candidates.filter(
      (obs) => obs.encounterUuid && order.encounter?.uuid && obs.encounterUuid === order.encounter.uuid,
    );

    // A result cannot predate the order that asked for it.
    const afterOrder = candidates.filter(
      (obs) => obs.effectiveDateTime && order.dateActivated && obs.effectiveDateTime >= order.dateActivated,
    );

    const pool = sameEncounter.length ? sameEncounter : afterOrder;
    const obs = [...pool].sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? ''))[0];

    if (obs) {
      claimed.add(obs.uuid);
    }
    matches.set(order.uuid, obs);
  }

  return orders.map((order) => ({ order, obs: matches.get(order.uuid) }));
}

/**
 * Start of the notification window as an epoch timestamp, or `undefined` when the bound is off.
 *
 * `notificationWindowDays: 0` disables the horizon, restoring the unbounded behaviour for distros
 * that would rather see everything the order search returns.
 */
export function notificationWindowStart(notificationWindowDays: number, now = Date.now()): number | undefined {
  return notificationWindowDays > 0 ? now - notificationWindowDays * 24 * 60 * 60 * 1000 : undefined;
}

/**
 * Whether a notification is recent enough to still be worth raising.
 *
 * Measured against `resultDate` — the result's own timestamp, falling back to the order date for a
 * rejection, which never gets a result. Deliberately not the date the order was *placed*: a
 * slow-turnaround test ordered outside the window but resulted just now is exactly the thing the
 * bell exists for. A notification carrying no usable date is kept rather than silently dropped.
 */
export function isWithinNotificationWindow(resultDate: string | undefined, windowStart: number | undefined): boolean {
  if (windowStart === undefined || !resultDate) {
    return true;
  }
  const resultTime = Date.parse(resultDate);
  return Number.isNaN(resultTime) || resultTime >= windowStart;
}

const noNotifications: Array<LabNotification> = [];

/**
 * Derives the lab notifications that need a clinician's attention for the open chart.
 *
 * Everything is computed client-side from the order REST resource and FHIR observations; this source
 * needs no notification backend at all.
 *
 * Read and review state are *not* applied here — the core owns those, so that every source's
 * notifications are triaged the same way.
 */
export function useLabNotifications(patientUuid: string | null, config: LabSourceConfig) {
  const {
    enabled,
    labOrderTypeUuid,
    locationScoped,
    notifyOnAbnormalNonCritical,
    notificationWindowDays,
    pollingIntervalMs,
  } = config;
  const session = useSession();
  const optIns = useOptIns();

  const shouldFetch = Boolean(enabled && patientUuid);

  const ordersUrl = shouldFetch
    ? `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${careSettingUuid}&status=any&orderType=${labOrderTypeUuid}&v=custom:(uuid,orderNumber,dateActivated,urgency,fulfillerStatus,fulfillerComment,display,patient:(uuid),concept:(uuid,display),orderer:(display,person:(display)),encounter:(uuid,location:(uuid,display)))`
    : null;
  const observationsUrl = shouldFetch
    ? `${fhirBaseUrl}/Observation?patient=${patientUuid}&category=laboratory&_sort=-_date&_count=100`
    : null;

  const {
    data: ordersResponse,
    error: ordersError,
    isLoading: isLoadingOrders,
    mutate: mutateOrders,
  } = useSWR<FetchResponse<OrderFetchResponse>, Error>(ordersUrl, openmrsFetch, {
    refreshInterval: pollingIntervalMs,
  });

  const {
    data: observationsResponse,
    error: observationsError,
    isLoading: isLoadingObservations,
    mutate: mutateObservations,
  } = useSWR<FetchResponse<FhirObservationBundle>, Error>(observationsUrl, openmrsFetch, {
    refreshInterval: pollingIntervalMs,
  });

  const orders = useMemo(() => ordersResponse?.data?.results ?? [], [ordersResponse]);

  const rawObservations = useMemo(
    () => (observationsResponse?.data?.entry ?? []).map((entry) => toRawObservation(entry.resource)),
    [observationsResponse],
  );

  const conceptUuids = useMemo(
    () => Array.from(new Set(orders.map((order) => order.concept?.uuid).filter(Boolean))),
    [orders],
  );

  // Critical-tier accuracy depends on the dictionary populating critical ranges; the assessor reads
  // the same endpoint the results viewer does, so the two agree on what "critical" means.
  const { assess } = useReferenceRangeAssessor(shouldFetch ? patientUuid : undefined, conceptUuids);

  const notifications = useMemo(() => {
    if (!shouldFetch) {
      return noNotifications;
    }

    const sessionLocationUuid = session?.sessionLocation?.uuid;

    // The order search is not date-bounded — it returns the newest page of the patient's lab orders,
    // which for a long-standing patient can reach back years. Without a horizon every old rejected
    // sample and every long-settled STAT result reappears in the bell, and because review state is
    // per user per browser, each clinician gets that backlog again on each new workstation.
    const windowStart = notificationWindowStart(notificationWindowDays);

    const derived = joinObservationsToOrders(orders, rawObservations)
      .map(({ order, obs }) =>
        toLabNotification(order, obs ? { ...obs, assessment: assess(obs.assessmentInput) } : undefined, {
          notifyOnAbnormalNonCritical,
          // Bounded by when the opt-in was recorded, so ticking the toggle once cannot light up
          // orders of the same test placed earlier with it switched off.
          optedIn: optInCoversOrder(optIns[optInKey(patientUuid, order.concept?.uuid)], order.dateActivated),
        }),
      )
      .filter((notification): notification is LabNotification => notification !== null)
      // Bounds the bell to recent activity; see isWithinNotificationWindow for why it keys off the
      // result date rather than the order date.
      .filter((notification) => isWithinNotificationWindow(notification.resultDate, windowStart))
      // Only surface a notification at the location where the order was placed. Orders with no
      // recorded location are always shown rather than silently hidden.
      .filter(
        (notification) =>
          !locationScoped ||
          !sessionLocationUuid ||
          !notification.locationUuid ||
          notification.locationUuid === sessionLocationUuid,
      );

    return sortLabNotifications(derived);
  }, [
    assess,
    locationScoped,
    notificationWindowDays,
    notifyOnAbnormalNonCritical,
    optIns,
    orders,
    patientUuid,
    rawObservations,
    session?.sessionLocation?.uuid,
    shouldFetch,
  ]);

  const mutate = useMemo(
    () => () => {
      mutateOrders();
      mutateObservations();
    },
    [mutateOrders, mutateObservations],
  );

  return {
    notifications,
    isLoading: shouldFetch && (isLoadingOrders || isLoadingObservations),
    error: ordersError ?? observationsError ?? null,
    mutate,
  };
}
