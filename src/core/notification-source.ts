import { createGlobalStore, useStore } from '@openmrs/esm-framework';
import type { NotificationSource } from './types';

interface SourceRegistry {
  sources: Array<NotificationSource>;
}

/**
 * The registered notification sources.
 *
 * A global store rather than a plain module-level array so that a source registered after the bell
 * has already mounted still shows up — the registry is read through {@link useNotificationSources},
 * and a distro's own frontend module registers whenever its `startupApp` runs, which is not
 * ordered against ours.
 */
const sourceRegistry = createGlobalStore<SourceRegistry>('smart-notifications-sources', { sources: [] });

/**
 * Registers a notification source. Call this from a frontend module's `startupApp`.
 *
 * Registering the same id twice replaces the earlier registration rather than adding a second one,
 * so a hot reload or a double-loaded module cannot make every notification appear twice.
 */
export function registerNotificationSource(source: NotificationSource) {
  const { sources } = sourceRegistry.getState();
  const existing = sources.findIndex((candidate) => candidate.id === source.id);

  if (existing === -1) {
    sourceRegistry.setState({ sources: [...sources, source] });
    return;
  }

  const next = [...sources];
  next[existing] = source;
  sourceRegistry.setState({ sources: next });
}

export function unregisterNotificationSource(sourceId: string) {
  const { sources } = sourceRegistry.getState();
  const next = sources.filter((source) => source.id !== sourceId);
  if (next.length !== sources.length) {
    sourceRegistry.setState({ sources: next });
  }
}

export function getNotificationSources(): Array<NotificationSource> {
  return sourceRegistry.getState().sources;
}

export function getNotificationSource(sourceId: string): NotificationSource | undefined {
  return getNotificationSources().find((source) => source.id === sourceId);
}

export function useNotificationSources(): Array<NotificationSource> {
  return useStore(sourceRegistry).sources;
}

/** Test seam: empties the registry. */
export function _resetNotificationSources() {
  sourceRegistry.setState({ sources: [] });
}
