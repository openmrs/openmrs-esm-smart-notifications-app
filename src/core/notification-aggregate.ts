import { createGlobalStore, useStore } from '@openmrs/esm-framework';
import type { SmartNotification } from './types';

export interface SourceSlot {
  notifications: Array<SmartNotification>;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

interface AggregateState {
  /** Source id -> that source's latest result. */
  slots: Record<string, SourceSlot>;
}

/**
 * What every source has most recently produced.
 *
 * The sources are polled by the runner components in `notification-aggregator.component.tsx`, which
 * publish here; everything else in the app reads. Going through a store rather than calling the
 * source hooks directly is what lets the bell, the panel rows and the full-page inbox — three
 * components the shell mounts into three unrelated trees — agree on one list without fetching it
 * three times.
 */
const aggregateStore = createGlobalStore<AggregateState>('smart-notifications-aggregate', { slots: {} });

const noop = () => {};

/** An empty slot, used for a source that has not reported yet. Stable identity on purpose. */
const emptySlot: SourceSlot = { notifications: [], isLoading: true, error: null, mutate: noop };

/**
 * Records a source's latest result.
 *
 * Idempotent by value, so mounting a second aggregator — the inbox page opened while the header
 * bell is already running — does not churn the store or re-render every consumer.
 */
export function publishSourceResult(sourceId: string, slot: SourceSlot) {
  const { slots } = aggregateStore.getState();
  const previous = slots[sourceId];

  if (
    previous &&
    previous.notifications === slot.notifications &&
    previous.isLoading === slot.isLoading &&
    previous.error === slot.error
  ) {
    return;
  }

  aggregateStore.setState({ slots: { ...slots, [sourceId]: slot } });
}

/**
 * Drops a source's slot. Called when a source is unregistered, so its notifications leave the inbox
 * rather than sitting there frozen at whatever it last reported.
 */
export function retractSourceResult(sourceId: string) {
  const { slots } = aggregateStore.getState();
  if (!(sourceId in slots)) {
    return;
  }
  const next = { ...slots };
  delete next[sourceId];
  aggregateStore.setState({ slots: next });
}

export function useSourceSlots(): Record<string, SourceSlot> {
  return useStore(aggregateStore).slots;
}

export function getSourceSlot(sourceId: string): SourceSlot {
  return aggregateStore.getState().slots[sourceId] ?? emptySlot;
}

/** Test seam: empties every slot. */
export function _resetAggregate() {
  aggregateStore.setState({ slots: {} });
}
