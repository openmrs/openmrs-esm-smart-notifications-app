import React, { useEffect } from 'react';
import { useSession } from '@openmrs/esm-framework';
import { publishSourceResult, retractSourceResult } from './notification-aggregate';
import { useNotificationSources } from './notification-source';
import { useChartPatient } from './use-chart-patient';
import type { NotificationSource, NotificationSourceContext } from './types';

/**
 * Runs one source and publishes what it returns.
 *
 * A component per source, rather than one component looping over `sources.map(s =>
 * s.useNotifications(...))`, because the registry can grow after mount: a distro's own frontend
 * module registers during its `startupApp`, which is not ordered against ours. Calling the hooks in
 * a loop would change the hook count on that render and break the rules of hooks. Giving each
 * source its own component makes the loop a list of children instead, which React handles, and has
 * the side benefit that a source is free to use as many hooks as it needs.
 */
const NotificationSourceRunner: React.FC<{ source: NotificationSource; context: NotificationSourceContext }> = ({
  source,
  context,
}) => {
  const { notifications, isLoading, error, mutate } = source.useNotifications(context);

  useEffect(() => {
    publishSourceResult(source.id, { notifications, isLoading, error, mutate });
  }, [error, isLoading, mutate, notifications, source.id]);

  useEffect(() => () => retractSourceResult(source.id), [source.id]);

  return null;
};

/**
 * Drives every registered source. Renders nothing.
 *
 * Mounted by the header bell, which is present on every page the shell renders, and by the
 * full-page inbox for the case where it is opened on its own. Mounting it twice is harmless:
 * publishing is idempotent by value and SWR dedupes the requests by key.
 */
const NotificationAggregator: React.FC = () => {
  const sources = useNotificationSources();
  const session = useSession();
  const { patientUuid } = useChartPatient();

  const context: NotificationSourceContext = {
    patientUuid: patientUuid ?? null,
    userUuid: session?.user?.uuid ?? null,
  };

  return (
    <>
      {sources.map((source) => (
        <NotificationSourceRunner context={context} key={source.id} source={source} />
      ))}
    </>
  );
};

export default NotificationAggregator;
