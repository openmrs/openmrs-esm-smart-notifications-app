import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification, Toggle } from '@carbon/react';
import { showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type LabOrderContext, useNotifyWhenResulted } from './notify-when-resulted.resource';
import styles from './notify-when-resulted.scss';

interface NotifyWhenResultedProps {
  /** Supplied by `top-of-lab-order-form-slot` as `state={{ order: initialOrder }}`. */
  order?: LabOrderContext;
}

/**
 * Lets the ordering clinician opt in to being alerted the moment a lab order is resulted,
 * rendered into the test order form via the `top-of-lab-order-form-slot` extension slot.
 *
 * A routine order is filed silently to the chart today, so unless the value happens to
 * come back critical nothing tells the orderer that it has arrived. This is the control
 * that lets them ask to be told.
 *
 * The opt-in is kept in this module's store rather than on the order: the slot receives a
 * read-only copy of the order and cannot contribute to the host form's submission, and the
 * `Order` data model has no field for the preference. The inline notification tells the
 * clinician that delivery is still to come so the control does not over-promise.
 */
const NotifyWhenResulted: React.FC<NotifyWhenResultedProps> = ({ order }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { isOptedIn, canOptIn, setOptedIn } = useNotifyWhenResulted(order);

  const hint = t(
    'notifyWhenResultedHint',
    "Turning this on sends you a notification the moment this order is resulted, even if the value isn't critical.",
  );
  const futureReleaseNote = t('plannedForFutureRelease', 'Planned for a future release.');

  const handleToggle = useCallback(
    (checked: boolean) => {
      setOptedIn(checked);

      if (checked) {
        showSnackbar({
          isLowContrast: true,
          kind: 'success',
          title: t('notifyWhenResulted', 'Notify when resulted'),
          subtitle: `${hint} ${futureReleaseNote}`,
        });
      }
    },
    [futureReleaseNote, hint, setOptedIn, t],
  );

  // Without something to key the opt-in on there is nowhere to record the answer, so offer
  // no control at all rather than one that silently forgets.
  if (!canOptIn) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Toggle
        aria-label={t('notifyMeWhenResulted', 'Notify me when resulted')}
        id="notifyWhenResultedToggle"
        labelA={t('off', 'Off')}
        labelB={t('on', 'On')}
        labelText={t('notifyMeWhenResulted', 'Notify me when resulted')}
        onToggle={handleToggle}
        size={isTablet ? 'md' : 'sm'}
        toggled={isOptedIn}
      />
      <InlineNotification className={styles.hint} hideCloseButton kind="info" lowContrast>
        {hint} <span className={styles.futureReleaseNote}>{futureReleaseNote}</span>
      </InlineNotification>
    </div>
  );
};

export default NotifyWhenResulted;
