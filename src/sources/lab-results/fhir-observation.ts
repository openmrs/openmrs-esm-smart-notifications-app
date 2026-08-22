/**
 * Reading FHIR lab `Observation`s.
 *
 * Ported from `esm-patient-tests-app`'s `test-results/loadPatientTestData/helpers.ts`, which is
 * internal to that app rather than published, so there is nothing to import.
 */

import type { OBSERVATION_INTERPRETATION, ReferenceRanges } from './reference-ranges';

export interface FhirObservationResource {
  resourceType: string;
  id: string;
  code?: {
    coding?: Array<{ code?: string; display?: string }>;
    text?: string;
  };
  encounter?: { reference?: string };
  effectiveDateTime?: string;
  issued?: string;
  valueString?: string;
  valueQuantity?: { value?: number; unit?: string };
  valueCodeableConcept?: {
    coding?: Array<{ code?: string; display?: string }>;
    text?: string;
  };
  referenceRange?: Array<{
    low?: { value?: number };
    high?: { value?: number };
    type?: { coding?: Array<{ system?: string; code?: string }> };
  }>;
  interpretation?: Array<{
    coding?: Array<{ code?: string; display?: string; system?: string }>;
    text?: string;
  }>;
}

export interface FhirObservationBundle {
  entry?: Array<{ resource: FhirObservationResource }>;
}

const rangeMeaningSystem = 'http://terminology.hl7.org/CodeSystem/referencerange-meaning';
const openmrsRangeSystem = 'http://fhir.openmrs.org/ext/obs/reference-range';

/** Strips the resource type from a FHIR reference, e.g. "Encounter/abc-123" -> "abc-123". */
export function referenceId(reference: string | undefined): string | undefined {
  return reference?.split('/')[1];
}

/** The observation's value and, where it is a quantity, its units. */
export function observationValue(resource: FhirObservationResource): { value?: string; units?: string } {
  if (resource.valueQuantity) {
    return { value: String(resource.valueQuantity.value), units: resource.valueQuantity.unit };
  }
  if (resource.valueCodeableConcept) {
    return { value: resource.valueCodeableConcept.coding?.[0]?.display ?? resource.valueCodeableConcept.text };
  }
  if (resource.valueString) {
    return { value: resource.valueString };
  }
  return {};
}

/**
 * The ranges the lab reported against on this observation, if any.
 *
 * Returns `undefined` rather than an empty object when nothing usable was found, so the caller can
 * fall back to the concept's dictionary ranges.
 */
export function extractObservationReferenceRanges(resource: FhirObservationResource): ReferenceRanges | undefined {
  if (!resource.referenceRange || resource.referenceRange.length === 0) {
    return undefined;
  }

  const ranges: ReferenceRanges = { units: resource.valueQuantity?.unit };

  resource.referenceRange.forEach((range) => {
    const rangeType = range.type?.coding?.[0]?.code;
    const rangeSystem = range.type?.coding?.[0]?.system;

    if (rangeSystem === rangeMeaningSystem) {
      if (rangeType === 'normal') {
        ranges.hiNormal = range.high?.value;
        ranges.lowNormal = range.low?.value;
      } else if (rangeType === 'treatment') {
        ranges.hiCritical = range.high?.value;
        ranges.lowCritical = range.low?.value;
      }
    } else if (rangeSystem === openmrsRangeSystem && rangeType === 'absolute') {
      ranges.hiAbsolute = range.high?.value;
      ranges.lowAbsolute = range.low?.value;
    }
  });

  const foundABound = [
    ranges.hiNormal,
    ranges.lowNormal,
    ranges.hiCritical,
    ranges.lowCritical,
    ranges.hiAbsolute,
    ranges.lowAbsolute,
  ].some((bound) => bound !== undefined);

  return foundABound ? ranges : undefined;
}

const interpretationByCode: Record<string, OBSERVATION_INTERPRETATION> = {
  LL: 'CRITICALLY_LOW',
  HH: 'CRITICALLY_HIGH',
  L: 'LOW',
  H: 'HIGH',
  N: 'NORMAL',
  LU: 'OFF_SCALE_LOW',
  HU: 'OFF_SCALE_HIGH',
};

const interpretationByDisplay: Record<string, OBSERVATION_INTERPRETATION> = {
  'critically low': 'CRITICALLY_LOW',
  'critically high': 'CRITICALLY_HIGH',
  low: 'LOW',
  high: 'HIGH',
  normal: 'NORMAL',
  'off scale low': 'OFF_SCALE_LOW',
  'off scale high': 'OFF_SCALE_HIGH',
};

/**
 * The interpretation the lab itself supplied, where it supplied one.
 *
 * Accepts either an HL7 v3 ObservationInterpretation code ("LL", "H") or a display string
 * ("Critically low"), because implementations vary in which they populate.
 */
export function extractObservationInterpretation(
  resource: FhirObservationResource,
): OBSERVATION_INTERPRETATION | undefined {
  const interpretation = resource.interpretation?.[0];
  if (!interpretation) {
    return undefined;
  }

  const code = interpretation.coding?.[0]?.code;
  if (code && interpretationByCode[code.toUpperCase()]) {
    return interpretationByCode[code.toUpperCase()];
  }

  const display = interpretation.coding?.[0]?.display ?? interpretation.text;
  return display ? interpretationByDisplay[display.trim().toLowerCase()] : undefined;
}
