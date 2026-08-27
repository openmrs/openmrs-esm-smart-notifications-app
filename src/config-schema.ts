import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  badge: {
    countRoutineNotifications: {
      _type: Type.Boolean,
      _default: false,
      _description:
        'Whether routine (low acuity) notifications count towards the bell badge. By default only critical and STAT notifications increment the badge, matching the smart notification workflow.',
    },
    maxCount: {
      _type: Type.Number,
      _default: 99,
      _description: 'The maximum unread count to display in the badge before showing a "+" suffix (e.g. "99+").',
    },
  },
};

export interface ConfigSchema {
  badge: {
    countRoutineNotifications: boolean;
    maxCount: number;
  };
}
