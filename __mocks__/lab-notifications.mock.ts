/**
 * Fixtures for the lab-results notification source.
 *
 * The orders below cover the four triggers in the notification rule, plus a routine in-range result
 * that must produce nothing — the "alert fatigue" control case.
 */

import type { LabOrder, ResultedObservation } from '../src/sources/lab-results/lab-notification-model';
import {
  assessObservation,
  type ObservationAssessmentInput,
  type ReferenceRanges,
} from '../src/sources/lab-results/reference-ranges';

const encounterUuid = 'encounter-uuid-1';
const locationUuid = 'location-uuid-outpatient';
const patientUuid = '8673ee4f-e2ab-4077-ba55-4980f408773e';

function buildOrder(overrides: Partial<LabOrder> = {}): LabOrder {
  return {
    uuid: 'order-uuid-1',
    concept: { uuid: 'concept-creatinine', display: 'Serum creatinine' },
    dateActivated: '2026-06-29T09:00:00.000+0000',
    display: 'Serum creatinine',
    encounter: {
      uuid: encounterUuid,
      location: { uuid: locationUuid, display: 'Outpatient Triage' },
    },
    fulfillerComment: undefined,
    fulfillerStatus: 'COMPLETED',
    orderNumber: 'ORD-1001',
    orderer: { display: 'Dr. Sarah Smith', person: { display: 'Dr. Sarah Smith' } },
    patient: { uuid: patientUuid },
    urgency: 'ROUTINE',
    ...overrides,
  };
}

export const mockSmartNotificationsPatientUuid = patientUuid;
export const mockSmartNotificationsLocationUuid = locationUuid;
export const mockSmartNotificationsEncounterUuid = encounterUuid;

export const mockRoutineOrder = buildOrder();

export const mockStatOrder = buildOrder({
  uuid: 'order-uuid-stat',
  concept: { uuid: 'concept-haemoglobin', display: 'Haemoglobin' },
  orderNumber: 'ORD-1002',
  urgency: 'STAT',
});

export const mockDeclinedOrder = buildOrder({
  uuid: 'order-uuid-declined',
  concept: { uuid: 'concept-lipids', display: 'Lipid panel' },
  fulfillerComment: 'Haemolysed sample',
  fulfillerStatus: 'DECLINED',
  orderNumber: 'ORD-1003',
});

export interface RawObservation {
  uuid: string;
  conceptUuid: string;
  display: string;
  panelDisplay?: string;
  value?: string;
  units?: string;
  ranges?: ReferenceRanges;
  interpretation?: ObservationAssessmentInput['interpretation'];
  effectiveDateTime: string;
}

/**
 * Runs a raw fixture through the real assessment, so tests exercise the same path production does
 * rather than hand-asserting an interpretation the code might not actually derive.
 */
export function resulted(raw: RawObservation, overrides: Partial<RawObservation> = {}): ResultedObservation {
  const { ranges, interpretation, units, ...rest } = { ...raw, ...overrides };

  return {
    ...rest,
    assessment: assessObservation({
      conceptUuid: rest.conceptUuid,
      value: rest.value,
      units,
      observationRanges: ranges,
      interpretation,
    }),
  };
}

/** In range: 1.1 sits inside 0.6 – 1.2, so this is the result that must NOT notify on its own. */
export const mockNormalObservation: RawObservation = {
  uuid: 'obs-uuid-normal',
  conceptUuid: 'concept-creatinine',
  display: 'Serum creatinine',
  panelDisplay: 'Serum chemistry panel',
  value: '1.1',
  units: 'mg/dL',
  ranges: { lowNormal: 0.6, hiNormal: 1.2, lowCritical: 0.2, hiCritical: 4, units: 'mg/dL' },
  effectiveDateTime: '2026-06-29T09:30:00.000+0000',
};

/** Below lowCritical (5), so it must notify regardless of how it was ordered. */
export const mockCriticalObservation: RawObservation = {
  uuid: 'obs-uuid-critical',
  conceptUuid: 'concept-haemoglobin',
  display: 'Haemoglobin',
  value: '4.1',
  units: 'g/dL',
  ranges: { lowNormal: 12, hiNormal: 14, lowCritical: 5, hiCritical: 20, units: 'g/dL' },
  effectiveDateTime: '2026-06-29T09:35:00.000+0000',
};

/** Out of range but not critical: only notifies when notifyOnAbnormalNonCritical is on. */
export const mockAbnormalObservation: RawObservation = {
  uuid: 'obs-uuid-abnormal',
  conceptUuid: 'concept-haemoglobin',
  display: 'Haemoglobin',
  value: '11',
  units: 'g/dL',
  ranges: { lowNormal: 12, hiNormal: 14, lowCritical: 5, hiCritical: 20, units: 'g/dL' },
  effectiveDateTime: '2026-06-29T09:36:00.000+0000',
};

/** A FHIR Observation bundle entry, as the resource hook receives it. */
export const mockFhirObservationBundle = {
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-uuid-normal',
        code: {
          coding: [{ code: 'concept-creatinine', display: 'Serum creatinine' }],
          text: 'Serum creatinine',
        },
        encounter: { reference: `Encounter/${encounterUuid}`, type: 'Encounter' },
        effectiveDateTime: '2026-06-29T09:30:00.000+0000',
        issued: '2026-06-29T09:30:00.000+0000',
        valueQuantity: { value: 1.1, unit: 'mg/dL', system: 'http://unitsofmeasure.org', code: 'mg/dL' },
        referenceRange: [
          {
            low: { value: 0.6 },
            high: { value: 1.2 },
            type: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/referencerange-meaning', code: 'normal' }],
            },
          },
        ],
      },
    },
  ],
};
