/**
 * Everything the lab source knows about reference ranges.
 *
 * The ranges themselves come from OpenMRS — `/conceptreferencerange` for the concept's bounds as
 * configured for this patient, plus whatever the lab reported on the observation itself. This module
 * fetches them, decides what a value *means* against them, and hands back only the result: an
 * interpretation, a formatted range and whether it is critical. Callers never see the bounds and
 * never do the arithmetic, so there is exactly one place where a value becomes "critically high".
 *
 * The assessment and the range formatting are ported from `@openmrs/esm-patient-common-lib`
 * (`src/results/helpers.ts`, `src/results/useReferenceRanges.ts`) rather than imported: that library
 * is the *patient chart's* shared code, and depending on it would pull workspaces, visits, the order
 * basket and the form engine into a module whose whole point is to know nothing about any one
 * clinical domain. If the numbers here ever disagree with the results viewer's, the two have drifted
 * and this copy is the one to fix — the chart's is what clinicians read a result against.
 */

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export type OBSERVATION_INTERPRETATION =
  | 'NORMAL'
  | 'HIGH'
  | 'CRITICALLY_HIGH'
  | 'OFF_SCALE_HIGH'
  | 'LOW'
  | 'CRITICALLY_LOW'
  | 'OFF_SCALE_LOW'
  // Legacy sentinel for "no data"; avoid new usage and prefer undefined instead.
  | '--';

/** The bounds as OpenMRS stores them. Data only — the meaning is derived here, not by callers. */
export interface ReferenceRanges {
  hiAbsolute?: number;
  hiCritical?: number;
  hiNormal?: number;
  lowAbsolute?: number;
  lowCritical?: number;
  lowNormal?: number;
  units?: string;
}

/** The outpatient care setting, which is what lab orders are placed against. */
export const careSettingUuid = '6f0c9a92-6f24-11e3-af88-005056821db0';

const criticalInterpretations: ReadonlyArray<OBSERVATION_INTERPRETATION> = [
  'CRITICALLY_HIGH',
  'CRITICALLY_LOW',
  'OFF_SCALE_HIGH',
  'OFF_SCALE_LOW',
];

const abnormalInterpretations: ReadonlyArray<OBSERVATION_INTERPRETATION> = ['HIGH', 'LOW'];

const isSet = (value: number | undefined): value is number => value !== null && value !== undefined;

function exist(...values: Array<unknown>): boolean {
  return values.every((value) => value !== null && value !== undefined);
}

/**
 * Formats a range for display, e.g. "35 – 147 U/L", or "--" when there is no usable normal band.
 */
function formatReferenceRange(ranges: ReferenceRanges | undefined, units?: string): string {
  if (!ranges) {
    return '--';
  }
  const { lowNormal, hiNormal } = ranges;
  const displayUnits = ranges.units || units || '';
  if (exist(lowNormal, hiNormal)) {
    return `${lowNormal} – ${hiNormal}${displayUnits ? ` ${displayUnits}` : ''}`;
  }
  return '--';
}

/**
 * Interprets a numeric result against its bounds.
 *
 * Critical and absolute thresholds compare inclusively (`>=`, `<=`) because a value sitting exactly
 * on the boundary should be flagged; normal thresholds compare exclusively (`>`, `<`) so a value on
 * the edge of the normal band is still normal.
 */
function assessValue(value: number, ranges: ReferenceRanges): OBSERVATION_INTERPRETATION {
  if (Number.isNaN(value)) {
    return 'NORMAL';
  }
  if (isSet(ranges.hiAbsolute) && value >= ranges.hiAbsolute) {
    return 'OFF_SCALE_HIGH';
  }
  if (isSet(ranges.hiCritical) && value >= ranges.hiCritical) {
    return 'CRITICALLY_HIGH';
  }
  if (isSet(ranges.hiNormal) && value > ranges.hiNormal) {
    return 'HIGH';
  }
  if (isSet(ranges.lowAbsolute) && value <= ranges.lowAbsolute) {
    return 'OFF_SCALE_LOW';
  }
  if (isSet(ranges.lowCritical) && value <= ranges.lowCritical) {
    return 'CRITICALLY_LOW';
  }
  if (isSet(ranges.lowNormal) && value < ranges.lowNormal) {
    return 'LOW';
  }
  return 'NORMAL';
}

/**
 * Whether the concept has a normal band we can judge its critical bounds against.
 *
 * A band collapsed to a point — most often `0`/`0` from dictionary fields that were never filled in
 * — tells us nothing about where "critical" begins, so it counts as no band at all.
 */
function hasUsableNormalRange(ranges: ReferenceRanges): boolean {
  const { hiNormal, lowNormal } = ranges;
  if (!isSet(hiNormal) && !isSet(lowNormal)) {
    return false;
  }
  return !(isSet(hiNormal) && isSet(lowNormal) && hiNormal <= lowNormal);
}

/**
 * Drops critical and absolute bounds that contradict the concept's normal range.
 *
 * {@link assessValue} accepts `0` as a real bound, so a concept whose `hiCritical` is stored as `0`
 * rather than left unset marks *every* positive result CRITICALLY_HIGH. Critical values notify
 * regardless of opt-in and cannot be configured off — that is a patient-safety guarantee — so a
 * single badly configured concept would otherwise put a notification on the bell for every resulted
 * order.
 *
 * A critical-high threshold below the normal range cannot be right, so it is ignored rather than
 * allowed to manufacture a critical. Coherent ranges pass through untouched, which is what keeps
 * this safe: it can only ever remove a false critical, never suppress a real one.
 */
export function withCoherentCriticalBounds(ranges: ReferenceRanges | undefined): ReferenceRanges | undefined {
  if (!ranges) {
    return ranges;
  }

  // With nothing to anchor against we cannot tell a real threshold from an unset field left at 0,
  // so every critical and absolute bound is dropped. This is the safe direction: a concept in this
  // state can still raise CRITICAL the normal way — from an interpretation the lab itself supplied,
  // which {@link assessObservation} prefers anyway.
  if (!hasUsableNormalRange(ranges)) {
    return { units: ranges.units };
  }

  const upperReference = ranges.hiNormal ?? ranges.lowNormal;
  const lowerReference = ranges.lowNormal ?? ranges.hiNormal;
  const coherent = { ...ranges };

  if (isSet(upperReference)) {
    if (isSet(coherent.hiCritical) && coherent.hiCritical < upperReference) {
      coherent.hiCritical = undefined;
    }
    if (isSet(coherent.hiAbsolute) && coherent.hiAbsolute < upperReference) {
      coherent.hiAbsolute = undefined;
    }
  }

  if (isSet(lowerReference)) {
    if (isSet(coherent.lowCritical) && coherent.lowCritical > lowerReference) {
      coherent.lowCritical = undefined;
    }
    if (isSet(coherent.lowAbsolute) && coherent.lowAbsolute > lowerReference) {
      coherent.lowAbsolute = undefined;
    }
  }

  return coherent;
}

/** What the caller knows about a result. Bounds are supplied by this module, not by the caller. */
export interface ObservationAssessmentInput {
  /** Identifies which concept's dictionary ranges apply. */
  conceptUuid?: string;
  value?: string;
  units?: string;
  /** Ranges the lab reported on the observation itself. These win over the dictionary's. */
  observationRanges?: ReferenceRanges;
  /** An interpretation the lab supplied. Preferred over anything derived here. */
  interpretation?: OBSERVATION_INTERPRETATION;
}

/** What a result *means*. This is the only thing that leaves this module. */
export interface ObservationAssessment {
  interpretation?: OBSERVATION_INTERPRETATION;
  /** Display text such as "0.6 – 1.2 mg/dL", or "--" when there is no usable band. */
  referenceRangeText: string;
  units?: string;
  /** Always notifies, whatever the config says. */
  isCritical: boolean;
  /** Out of range but not critical; only notifies when the distro has asked for it. */
  isAbnormal: boolean;
}

/**
 * Assesses one result against the ranges that apply to it.
 *
 * Exported for unit tests and for callers that already hold the concept's ranges; the normal entry
 * point is {@link useReferenceRangeAssessor}, which supplies them from the backend.
 */
export function assessObservation(
  input: ObservationAssessmentInput,
  conceptRanges?: ReferenceRanges,
): ObservationAssessment {
  // Observation-level ranges — what the lab actually reported against — win over the dictionary's.
  const ranges = input.observationRanges ?? conceptRanges;
  const units = input.units ?? ranges?.units;
  const interpretation = input.interpretation ?? deriveInterpretation(input.value, ranges);

  return {
    interpretation,
    referenceRangeText: formatReferenceRange(ranges, units),
    units,
    isCritical: Boolean(interpretation) && criticalInterpretations.includes(interpretation),
    isAbnormal: Boolean(interpretation) && abnormalInterpretations.includes(interpretation),
  };
}

function deriveInterpretation(
  value: string | undefined,
  ranges: ReferenceRanges | undefined,
): OBSERVATION_INTERPRETATION | undefined {
  if (value == null || !ranges) {
    return undefined;
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return undefined;
  }
  return assessValue(numericValue, withCoherentCriticalBounds(ranges));
}

interface ReferenceRangeResponse {
  uuid: string;
  concept: string;
  lowNormal?: number;
  hiNormal?: number;
  lowAbsolute?: number;
  hiAbsolute?: number;
  lowCritical?: number;
  hiCritical?: number;
  units?: string;
}

export interface UseReferenceRangeAssessorResult {
  /** Assesses a result using the ranges this hook fetched. */
  assess: (input: ObservationAssessmentInput) => ObservationAssessment;
  isLoading: boolean;
  error: Error | undefined;
}

/**
 * Fetches the patient's reference ranges for the given concepts and returns an assessor bound to
 * them.
 *
 * `/conceptreferencerange` is the same endpoint the results viewer reads, so the bell and the chart
 * agree on what "critical" means for a given concept and patient. Until the ranges arrive the
 * assessor still works — it falls back to whatever the lab reported on the observation itself.
 */
export function useReferenceRangeAssessor(
  patientUuid: string | undefined,
  conceptUuids: Array<string>,
): UseReferenceRangeAssessorResult {
  const conceptList = conceptUuids.filter(Boolean).join(',');
  const apiUrl =
    patientUuid && conceptList
      ? `${restBaseUrl}/conceptreferencerange?patient=${patientUuid}&concept=${conceptList}&v=full`
      : null;

  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<ReferenceRangeResponse> }>, Error>(
    apiUrl,
    openmrsFetch,
  );

  const rangesByConcept = useMemo(() => {
    const map = new Map<string, ReferenceRanges>();
    data?.data?.results?.forEach((range) => {
      if (range.concept) {
        map.set(range.concept, {
          lowNormal: range.lowNormal,
          hiNormal: range.hiNormal,
          lowAbsolute: range.lowAbsolute,
          hiAbsolute: range.hiAbsolute,
          lowCritical: range.lowCritical,
          hiCritical: range.hiCritical,
          units: range.units,
        });
      }
    });
    return map;
  }, [data]);

  const assess = useCallback(
    (input: ObservationAssessmentInput) =>
      assessObservation(input, input.conceptUuid ? rangesByConcept.get(input.conceptUuid) : undefined),
    [rangesByConcept],
  );

  return { assess, isLoading, error };
}
