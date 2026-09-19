import { useMemo } from 'react';
import { createGlobalStore, useStore } from '@openmrs/esm-framework';
import { reviewedBannerWindowMs, reviewedStorageKey } from './constants';
import { persistRecordOnChange, readRecordFromStorage } from './local-storage';

export interface ReviewRecord {
  /** Denormalised so a "reviewed" receipt can name the reviewer without a provider lookup. */
  providerDisplay: string;
  reviewedAt: string;
  patientUuid: string;
  /** Denormalised for the same reason, so the receipt can say *which* notification was signed off. */
  testLabel?: string;
}

export interface ReviewState {
  userUuid: string | null;
  reviewed: Record<string, ReviewRecord>;
}

const reviewStore = createGlobalStore<ReviewState>('smart-notifications-review', {
  userUuid: null,
  reviewed: {},
});

persistRecordOnChange(reviewStore, reviewedStorageKey, (state) => state.reviewed);

/**
 * Points the store at a user and loads that user's review state. Called by the bell as soon as the
 * session is known, so a shared workstation doesn't show one clinician's triage to the next.
 */
export function setReviewUser(userUuid: string) {
  const state = reviewStore.getState();
  if (state.userUuid === userUuid) {
    return;
  }
  reviewStore.setState({
    userUuid,
    reviewed: userUuid ? readRecordFromStorage<ReviewRecord>(reviewedStorageKey(userUuid)) : {},
  });
}

export function markNotificationReviewed(id: string, patientUuid: string, providerDisplay: string, testLabel?: string) {
  const { reviewed } = reviewStore.getState();
  reviewStore.setState({
    reviewed: {
      ...reviewed,
      [id]: { providerDisplay, patientUuid, testLabel, reviewedAt: new Date().toISOString() },
    },
  });
}

export function getReviewedNotifications(): Record<string, ReviewRecord> {
  return reviewStore.getState().reviewed;
}

/** Test seam: drops in-memory review state. */
export function _resetReviewStore() {
  reviewStore.setState({ userUuid: null, reviewed: {} });
}

export function useReviewedNotifications(): Record<string, ReviewRecord> {
  return useStore(reviewStore).reviewed;
}

/**
 * The most recent review for a patient, which is what a chart shows after "View in chart" brings
 * the clinician over from the inbox.
 *
 * Bounded to {@link reviewedBannerWindowMs}: the receipt is about one notification, so a review
 * older than that stops being reported. A record whose timestamp will not parse is dropped rather
 * than kept — the opposite of the notification window in the lab source, because here the risk runs
 * the other way. Hiding a notification could cost a clinician a critical result; a stale green
 * "reviewed" strip is itself the hazard.
 */
export function useLatestReviewForPatient(patientUuid: string): ReviewRecord | undefined {
  const reviewed = useReviewedNotifications();

  return useMemo(() => {
    if (!patientUuid) {
      return undefined;
    }
    const cutoff = Date.now() - reviewedBannerWindowMs;
    return Object.values(reviewed)
      .filter((record) => record.patientUuid === patientUuid)
      .filter((record) => Date.parse(record.reviewedAt) >= cutoff)
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
  }, [patientUuid, reviewed]);
}
