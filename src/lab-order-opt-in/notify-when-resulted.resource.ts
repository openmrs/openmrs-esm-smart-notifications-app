import { useCallback } from 'react';
import { createGlobalStore, useStore } from '@openmrs/esm-framework';

/**
 * The subset of a test order that the `top-of-lab-order-form-slot` hands to its
 * extensions. Only the fields this module reads are declared: the slot lives in
 * `@openmrs/esm-patient-tests-app`, so the full `TestOrderBasketItem` type is not
 * available here and every field is treated as optional.
 */
export interface LabOrderContext {
  /** Present once the order has been saved; absent while it is still in the basket. */
  uuid?: string;
  testType?: {
    label?: string;
    conceptUuid?: string;
  };
  visit?: {
    patient?: {
      uuid?: string;
    };
  };
}

/**
 * Records which lab orders the clinician has asked to be alerted about as soon as a
 * result is entered, even when the value is not flagged as critical.
 *
 * This lives in the browser only. The `Order` data model has no field for the opt-in and
 * the notification service (phases 2 and 3 of O3-5751) does not exist yet, so there is
 * nowhere to persist it. Holding it in a module-owned store gives the delivery side a
 * single place to read the clinician's intent from once it lands, and keeps the choice
 * stable while the order form is open.
 */
export interface NotifyWhenResultedStore {
  /** Opt-in state keyed by {@link getOptInKey}. A missing key means "not opted in". */
  optIns: Record<string, boolean>;
}

export const notifyWhenResultedStoreName = 'smart-notifications-notify-when-resulted';

export const notifyWhenResultedStore = createGlobalStore<NotifyWhenResultedStore>(notifyWhenResultedStoreName, {
  optIns: {},
});

/**
 * Builds the key an opt-in is stored under.
 *
 * A new order has no UUID until it is saved, so fall back to the ordered concept: while
 * the order sits in the basket the opt-in means "this test", and once the order exists it
 * means "this order". The patient is taken from the order's visit where one is available
 * so that the same test ordered for two patients does not share an entry.
 *
 * @returns the key, or `null` when the order carries nothing identifying to key on.
 */
export function getOptInKey(order?: LabOrderContext): string | null {
  const orderPart = order?.uuid ?? order?.testType?.conceptUuid;

  if (!orderPart) {
    return null;
  }

  const patientUuid = order?.visit?.patient?.uuid;

  return patientUuid ? `${patientUuid}:${orderPart}` : orderPart;
}

/**
 * Reads and writes the opt-in for a single order.
 *
 * @param order the order the form is editing, as supplied by the extension slot.
 */
export function useNotifyWhenResulted(order?: LabOrderContext) {
  const key = getOptInKey(order);
  const { optIns } = useStore(notifyWhenResultedStore);

  const setOptedIn = useCallback(
    (optedIn: boolean) => {
      if (!key) {
        return;
      }

      notifyWhenResultedStore.setState((state) => ({ optIns: { ...state.optIns, [key]: optedIn } }));
    },
    [key],
  );

  return {
    /** Whether this order is opted in. Always `false` when the order cannot be keyed. */
    isOptedIn: key ? Boolean(optIns[key]) : false,
    /** Whether an opt-in can be recorded at all for this order. */
    canOptIn: key !== null,
    setOptedIn,
  };
}
