import { describe, expect, it } from 'vitest';
import { mockFhirObservationBundle } from '__mocks__';
import {
  extractObservationInterpretation,
  extractObservationReferenceRanges,
  type FhirObservationResource,
  observationValue,
  referenceId,
} from './fhir-observation';

const base = mockFhirObservationBundle.entry[0].resource as unknown as FhirObservationResource;

describe('referenceId', () => {
  it('strips the resource type from a FHIR reference', () => {
    expect(referenceId('Encounter/abc-123')).toBe('abc-123');
  });

  it('returns undefined for a missing reference', () => {
    expect(referenceId(undefined)).toBeUndefined();
  });
});

describe('observationValue', () => {
  it('reads a quantity with its units', () => {
    expect(observationValue(base)).toEqual({ value: '1.1', units: 'mg/dL' });
  });

  it('reads a coded value, which has no units', () => {
    const coded = { valueCodeableConcept: { coding: [{ display: 'Reactive' }], text: 'Reactive' } };

    expect(observationValue(coded as FhirObservationResource)).toEqual({ value: 'Reactive' });
  });

  it('falls back to the codeable concept text when the coding carries no display', () => {
    const coded = { valueCodeableConcept: { coding: [{}], text: 'Non-reactive' } };

    expect(observationValue(coded as FhirObservationResource)).toEqual({ value: 'Non-reactive' });
  });

  it('reads a plain string value', () => {
    expect(observationValue({ valueString: 'See report' } as FhirObservationResource)).toEqual({ value: 'See report' });
  });

  it('returns nothing for an observation with no value at all', () => {
    expect(observationValue({} as FhirObservationResource)).toEqual({});
  });
});

describe('extractObservationReferenceRanges', () => {
  it('reads the normal band the lab reported', () => {
    expect(extractObservationReferenceRanges(base)).toEqual(
      expect.objectContaining({ lowNormal: 0.6, hiNormal: 1.2, units: 'mg/dL' }),
    );
  });

  it('reads critical bounds from the treatment range', () => {
    const resource = {
      ...base,
      referenceRange: [
        {
          low: { value: 0.2 },
          high: { value: 4 },
          type: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/referencerange-meaning', code: 'treatment' }],
          },
        },
      ],
    };

    expect(extractObservationReferenceRanges(resource as FhirObservationResource)).toEqual(
      expect.objectContaining({ lowCritical: 0.2, hiCritical: 4 }),
    );
  });

  it("reads absolute bounds from OpenMRS's own extension", () => {
    const resource = {
      ...base,
      referenceRange: [
        {
          low: { value: 0 },
          high: { value: 50 },
          type: { coding: [{ system: 'http://fhir.openmrs.org/ext/obs/reference-range', code: 'absolute' }] },
        },
      ],
    };

    expect(extractObservationReferenceRanges(resource as FhirObservationResource)).toEqual(
      expect.objectContaining({ lowAbsolute: 0, hiAbsolute: 50 }),
    );
  });

  // Returning undefined rather than a units-only object is what lets the caller fall back to the
  // concept's dictionary ranges.
  it('returns undefined when the resource has no ranges', () => {
    expect(
      extractObservationReferenceRanges({ ...base, referenceRange: [] } as FhirObservationResource),
    ).toBeUndefined();
    expect(
      extractObservationReferenceRanges({ ...base, referenceRange: undefined } as FhirObservationResource),
    ).toBeUndefined();
  });

  it('returns undefined when the ranges carry no bound this module understands', () => {
    const resource = {
      ...base,
      referenceRange: [{ low: { value: 1 }, type: { coding: [{ system: 'http://example.org/other', code: 'odd' }] } }],
    };

    expect(extractObservationReferenceRanges(resource as FhirObservationResource)).toBeUndefined();
  });
});

describe('extractObservationInterpretation', () => {
  const withInterpretation = (interpretation: FhirObservationResource['interpretation']) =>
    ({ ...base, interpretation }) as FhirObservationResource;

  it.each([
    ['LL', 'CRITICALLY_LOW'],
    ['HH', 'CRITICALLY_HIGH'],
    ['L', 'LOW'],
    ['H', 'HIGH'],
    ['N', 'NORMAL'],
    ['LU', 'OFF_SCALE_LOW'],
    ['HU', 'OFF_SCALE_HIGH'],
  ])('maps the HL7 code %s', (code, expected) => {
    expect(extractObservationInterpretation(withInterpretation([{ coding: [{ code }] }]))).toBe(expected);
  });

  it('accepts a lowercase code', () => {
    expect(extractObservationInterpretation(withInterpretation([{ coding: [{ code: 'hh' }] }]))).toBe(
      'CRITICALLY_HIGH',
    );
  });

  // Implementations vary in whether they populate the code or only a display string.
  it.each([
    ['Critically low', 'CRITICALLY_LOW'],
    ['Critically high', 'CRITICALLY_HIGH'],
    ['Low', 'LOW'],
    ['High', 'HIGH'],
    ['Normal', 'NORMAL'],
    ['Off scale low', 'OFF_SCALE_LOW'],
    ['Off scale high', 'OFF_SCALE_HIGH'],
  ])('falls back to the display string %s', (display, expected) => {
    expect(extractObservationInterpretation(withInterpretation([{ coding: [{ display }] }]))).toBe(expected);
  });

  it('falls back to the interpretation text when there is no coding display', () => {
    expect(extractObservationInterpretation(withInterpretation([{ coding: [{}], text: 'High' }]))).toBe('HIGH');
  });

  it('returns undefined when the lab supplied no interpretation', () => {
    expect(extractObservationInterpretation(base)).toBeUndefined();
    expect(extractObservationInterpretation(withInterpretation([]))).toBeUndefined();
  });

  it('returns undefined for a code and display it does not recognise', () => {
    expect(
      extractObservationInterpretation(withInterpretation([{ coding: [{ code: 'XX', display: 'Odd' }] }])),
    ).toBeUndefined();
  });
});
