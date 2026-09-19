import { Type, validators } from '@openmrs/esm-framework';
import { notificationPriorities, notificationTypes } from './sources/notifications-backend/types';

/**
 * Core settings sit at the top level; everything a particular source needs lives under
 * `sources.<sourceId>`. A distro turns a whole class of notification off by disabling its source,
 * without touching the rest of the inbox.
 */
export const configSchema = {
  enabled: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Master switch. When false, the notification bell is not rendered at all.',
  },
  pollingIntervalMs: {
    _type: Type.Number,
    _default: 30000,
    _description:
      'How often, in milliseconds, to poll for new notifications. Latency between an event happening and the bell updating is at most this value.',
    _validators: [validators.inRange(5000, 600000)],
  },
  sources: {
    labResults: {
      enabled: {
        _type: Type.Boolean,
        _default: true,
        _description:
          "Surface lab results that need attention, derived on the client from the patient's orders and observations. Needs no backend module.",
      },
      labOrderTypeUuid: {
        _type: Type.UUID,
        _default: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
        _description: "Order type uuid for lab orders. Must match the distro's test-order configuration.",
      },
      notifyOnAbnormalNonCritical: {
        _type: Type.Boolean,
        _default: false,
        _description:
          'Also raise a notification for abnormal-but-not-critical values. Critical values always notify and cannot be turned off.',
      },
      locationScoped: {
        _type: Type.Boolean,
        _default: true,
        _description: 'Only surface a notification at the location where the order was placed.',
      },
      notificationWindowDays: {
        _type: Type.Number,
        _default: 7,
        _description:
          'How many days back a result or sample rejection can be and still raise a notification. Bounds the bell to recent activity: without it, opening a long-standing patient chart surfaces every rejected or STAT order still in the newest page of their lab history. Measured against the result date, so a slow-turnaround test still notifies when it comes back. Set to 0 to disable the bound and notify on everything fetched.',
        _validators: [validators.inRange(0, 3650)],
      },
    },
    notificationsBackend: {
      enabled: {
        _type: Type.Boolean,
        _default: false,
        _description:
          'Surface notifications raised server-side by the `notifications` backend module. Leave off unless that module is installed; with it off this source makes no requests.',
      },
      minimumPriority: {
        _type: Type.String,
        _default: 'LOW',
        _description:
          'Lowest priority to surface. Notifications the backend raised below this are not shown. Note the backend already suppresses routine results entirely.',
        _validators: [validators.oneOf(notificationPriorities)],
      },
      notificationTypes: {
        _type: Type.Array,
        _elements: {
          _type: Type.String,
          _validators: [validators.oneOf(notificationTypes)],
        },
        _default: [...notificationTypes],
        _description: 'Which notification types to surface.',
      },
      maxNotifications: {
        _type: Type.Number,
        _default: 50,
        _description: 'Maximum number of notifications to request from the backend per poll.',
        _validators: [validators.inRange(1, 500)],
      },
    },
  },
};

export interface ConfigSchema {
  enabled: boolean;
  pollingIntervalMs: number;
  sources: {
    labResults: {
      enabled: boolean;
      labOrderTypeUuid: string;
      notifyOnAbnormalNonCritical: boolean;
      locationScoped: boolean;
      notificationWindowDays: number;
    };
    notificationsBackend: {
      enabled: boolean;
      minimumPriority: 'LOW' | 'MEDIUM' | 'HIGH';
      notificationTypes: Array<'LAB_RESULT' | 'PRESCRIPTION' | 'SAMPLE_REJECTED' | 'GENERAL'>;
      maxNotifications: number;
    };
  };
}
