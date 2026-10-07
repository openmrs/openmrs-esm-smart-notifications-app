/**
 * localStorage helpers shared by the review, read and opt-in stores.
 *
 * All three keep a flat `Record<string, T>` and must degrade quietly: a corrupt or unavailable
 * store is a reason to lose triage state, never a reason to break the bell.
 */

export function readRecordFromStorage<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    // Anything other than a plain object (a stale format, a hand-edited value) is discarded.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function writeRecordToStorage<T>(key: string, value: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not persist smart notification state to ${key}`, error);
  }
}

interface UserScopedState {
  userUuid: string | null;
}

/**
 * Persists a user-scoped record whenever it changes, by subscribing rather than by writing inside
 * each setter.
 *
 * These stores are global by name, so another frontend module can hold the same store and mutate it
 * — the patient chart's test-order form records "Notify me when resulted" that way. Persisting from
 * a subscription means the caller only has to get the in-memory state right and this module remains
 * the single place that knows the storage format, whoever made the change.
 *
 * A change of `userUuid` is a *load* — {@link readRecordFromStorage} has just filled the record from
 * that user's key — so it is skipped rather than written straight back.
 */
export function persistRecordOnChange<S extends UserScopedState, T>(
  store: { subscribe(listener: (state: S, previous: S) => void): () => void },
  storageKey: (userUuid: string) => string,
  select: (state: S) => Record<string, T>,
) {
  return store.subscribe((state, previous) => {
    if (!state.userUuid || state.userUuid !== previous.userUuid) {
      return;
    }
    const record = select(state);
    if (record === select(previous)) {
      return;
    }
    writeRecordToStorage(storageKey(state.userUuid), record);
  });
}
