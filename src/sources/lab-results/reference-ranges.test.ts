import { describe, expect, it } from 'vitest';
import { assessObservation, withCoherentCriticalBounds, type ReferenceRanges } from './reference-ranges';

const creatinine: ReferenceRanges = { lowNormal: 0.6, hiNormal: 1.2, lowCritical: 0.2, hiCritical: 4, units: 'mg/dL' };

describe('assessObservation', () => {
  it('prefers an interpretation the lab supplied over one derived from ranges', () => {
    const assessment = assessObservation({ value: '1.1', interpretation: 'HIGH', observationRanges: creatinine });

    expect(assessment.interpretation).toBe('HIGH');
    expect(assessment.isAbnormal).toBe(true);
    expect(assessment.isCritical).toBe(false);
  });

  it('derives the interpretation from reference ranges when the lab supplied none', () => {
    expect(assessObservation({ value: '1.1', observationRanges: creatinine }).interpretation).toBe('NORMAL');
    expect(assessObservation({ value: '0.1', observationRanges: creatinine }).interpretation).toBe('CRITICALLY_LOW');
    expect(assessObservation({ value: '1.5', observationRanges: creatinine }).interpretation).toBe('HIGH');
  });

  it('flags the critical interpretations as critical', () => {
    expect(assessObservation({ value: '0.1', observationRanges: creatinine }).isCritical).toBe(true);
    expect(assessObservation({ value: '5', observationRanges: creatinine }).isCritical).toBe(true);
  });

  it('returns no interpretation for a non-numeric value the lab did not interpret', () => {
    expect(assessObservation({ value: 'Reactive', observationRanges: creatinine }).interpretation).toBeUndefined();
  });

  it('returns no interpretation when there are no ranges to compare against', () => {
    expect(assessObservation({ value: '1.1' }).interpretation).toBeUndefined();
  });

  it("prefers the observation's own ranges over the concept's", () => {
    const assessment = assessObservation(
      { value: '1.1', observationRanges: { lowNormal: 2, hiNormal: 5, units: 'mg/dL' } },
      creatinine,
    );

    // 1.1 is normal against the concept's 0.6–1.2 but low against what the lab actually reported.
    expect(assessment.interpretation).toBe('LOW');
    expect(assessment.referenceRangeText).toBe('2 – 5 mg/dL');
  });

  it('falls back to the concept ranges when the observation carries none', () => {
    expect(assessObservation({ value: '1.1' }, creatinine).referenceRangeText).toBe('0.6 – 1.2 mg/dL');
  });

  it('reports "--" when there is no usable normal band to display', () => {
    expect(assessObservation({ value: '1.1', observationRanges: { units: 'mg/dL' } }).referenceRangeText).toBe('--');
    expect(assessObservation({ value: '1.1' }).referenceRangeText).toBe('--');
  });
});

/**
 * A concept whose critical bound was never really configured — most often left at 0 — would
 * otherwise mark every positive result critical. Critical notifies regardless of opt-in and cannot
 * be turned off, so that single mis-configured concept would put a row on the bell for every
 * resulted order.
 */
describe('withCoherentCriticalBounds', () => {
  it('drops every critical and absolute bound when there is no normal band to judge them against', () => {
    expect(withCoherentCriticalBounds({ hiCritical: 0, units: 'mmol/L' })).toEqual({ units: 'mmol/L' });
    expect(withCoherentCriticalBounds({ hiAbsolute: 0, units: 'mmol/L' })).toEqual({ units: 'mmol/L' });
  });

  it('treats a normal band collapsed to a point as no band at all', () => {
    expect(withCoherentCriticalBounds({ lowNormal: 5, hiNormal: 5, hiCritical: 0 })).toEqual({ units: undefined });
  });

  it('drops a critical-high threshold that sits below the normal range', () => {
    const coherent = withCoherentCriticalBounds({ lowNormal: 4, hiNormal: 7, hiCritical: 2 });

    expect(coherent.hiCritical).toBeUndefined();
    expect(coherent.hiNormal).toBe(7);
  });

  it('drops a critical-low threshold that sits above the normal range', () => {
    const coherent = withCoherentCriticalBounds({ lowNormal: 4, hiNormal: 7, lowCritical: 9 });

    expect(coherent.lowCritical).toBeUndefined();
  });

  // It must only ever remove a bound it cannot trust, never suppress a real critical.
  it('leaves coherent ranges untouched', () => {
    const genuine: ReferenceRanges = { lowNormal: 4, hiNormal: 7, lowCritical: 2, hiCritical: 25 };

    expect(withCoherentCriticalBounds(genuine)).toEqual(genuine);
  });

  it('passes undefined through', () => {
    expect(withCoherentCriticalBounds(undefined)).toBeUndefined();
  });
});
