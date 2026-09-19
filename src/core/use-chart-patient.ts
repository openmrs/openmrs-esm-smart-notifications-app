import { getGlobalStore, useStore } from '@openmrs/esm-framework';

/**
 * The patient chart's own store, as `@openmrs/esm-patient-common-lib` declares it.
 *
 * Only the two fields this module reads are typed; the rest are left `unknown` because we are a
 * guest in this store and have no business depending on its full shape. Global stores are shared by
 * name across frontend modules, so this resolves to the very store the chart populates — no
 * dependency on the patient chart's package required.
 */
interface PatientChartStore {
  patientUuid: string | null;
  patient: fhir.Patient | null;
  visitContext: unknown;
  mutateVisitContext: unknown;
}

/**
 * Reads the patient whose chart is currently open.
 *
 * `usePatientChartStore` can't be used here: it requires the caller to already know the patient
 * uuid and returns an empty store otherwise. The bell lives in the top nav, outside the chart's
 * React tree, so it has to discover the open patient rather than be handed one. The chart app
 * populates this store on mount and clears it on unmount
 * (see `usePatientChartPatientAndVisit` in esm-patient-chart-app), so an empty store means
 * "no chart open".
 */
const patientChartStore = getGlobalStore<PatientChartStore>('patient-chart-global-store', {
  patientUuid: null,
  patient: null,
  visitContext: null,
  mutateVisitContext: null,
});

export function useChartPatient(): { patient: fhir.Patient | null; patientUuid: string | null } {
  const { patient, patientUuid } = useStore(patientChartStore);
  return { patient, patientUuid };
}
