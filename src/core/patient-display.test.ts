import { describe, expect, it } from 'vitest';
import { getPreferredIdentifier } from './patient-display';

describe('getPreferredIdentifier', () => {
  it('prefers the identifier FHIR marks as official', () => {
    const patient = {
      identifier: [
        { use: 'usual', value: '10001', type: { text: 'Legacy ID' } },
        { use: 'official', value: '10002', type: { text: 'OpenMRS ID' } },
      ],
    } as fhir.Patient;

    expect(getPreferredIdentifier(patient)).toEqual({ label: 'OpenMRS ID', value: '10002' });
  });

  it('falls back to the first identifier when none is marked official', () => {
    const patient = {
      identifier: [{ use: 'usual', value: '10001', type: { text: 'Legacy ID' } }],
    } as fhir.Patient;

    expect(getPreferredIdentifier(patient)).toEqual({ label: 'Legacy ID', value: '10001' });
  });

  it('falls back to the system when the identifier has no type text', () => {
    const patient = { identifier: [{ value: '10001', system: 'http://openmrs.org/id' }] } as fhir.Patient;

    expect(getPreferredIdentifier(patient)).toEqual({ label: 'http://openmrs.org/id', value: '10001' });
  });

  it('returns undefined for a patient with no identifiers', () => {
    expect(getPreferredIdentifier({ identifier: [] } as fhir.Patient)).toBeUndefined();
    expect(getPreferredIdentifier(undefined)).toBeUndefined();
    expect(getPreferredIdentifier(null)).toBeUndefined();
  });
});
