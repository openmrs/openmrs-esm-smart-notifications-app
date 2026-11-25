/**
 * Storage keys for the client-side state the core keeps on behalf of every source.
 *
 * Read and review state is tracked here rather than per-source because it is a property of the
 * inbox, not of where a notification came from: a clinician who has dealt with a row has dealt with
 * it regardless of which source raised it. Sources that have server-side lifecycle of their own
 * (see `markRead`/`markReviewed` on {@link import('./types').NotificationSource}) mirror the same
 * transitions to their backend.
 */

/** Review state is per-user, so a shared workstation doesn't leak one clinician's triage to the next. */
export function reviewedStorageKey(userUuid: string): string {
  return `openmrs:smart-notifications:reviewed:${userUuid}`;
}

/**
 * Read state is separate from review state, and per-user for the same reason. Opening a
 * notification marks it read — it stops counting against the bell but stays in the inbox until it
 * is actually reviewed.
 */
export function readStorageKey(userUuid: string): string {
  return `openmrs:smart-notifications:read:${userUuid}`;
}

/**
 * Opt-in is keyed by patient + concept; there is no order uuid at the time the checkbox is set.
 *
 * Per-user for the same reason as review and read state. "Notify me when resulted" is a promise to
 * the clinician who ticked it, and a browser-global store would quietly turn that into "notify
 * whoever signs in at this workstation next" — the next clinician would inherit the routine
 * notification and be able to clear it by re-ordering the same test with the toggle off.
 */
export function optInStorageKey(userUuid: string): string {
  return `openmrs:smart-notifications:opt-in:${userUuid}`;
}

export function optInKey(patientUuid: string, conceptUuid: string): string {
  return `${patientUuid}:${conceptUuid}`;
}

/**
 * How long a review goes on being reported to the chart that raised it.
 *
 * The "reviewed" receipt is a statement about the one notification that was just signed off, not
 * about the patient's current results. Unbounded it still reads "reviewed" weeks later — including
 * when newer unreviewed criticals have arrived since, which is exactly when it is most misleading.
 */
export const reviewedBannerWindowMs = 24 * 60 * 60 * 1000;
