# @openmrs/esm-smart-notifications-app

Frontend module for smart clinical notifications in O3.

## Quick start

\`\`\`bash
yarn install
yarn start
\`\`\`

Once started, your module will be available at:
**http://localhost:8080/openmrs/spa/smart-notifications-app**

## What's included

- ✅ OpenMRS 3.0 microfrontend setup
- ✅ Carbon Design System integration
- ✅ Internationalization (i18n) ready
- ✅ TypeScript configuration
- ✅ Jest testing setup
- ✅ ESLint + Prettier

## Learn more

### OpenMRS O3 resources

- [Getting Started](https://o3-docs.openmrs.org/en-US/docs/frontend-modules/setup) - Start here for O3 development
- [Creating a Frontend Module](https://o3-docs.openmrs.org/en-US/docs/recipes/create-a-frontend-module) - Step-by-step guide
- [Framework Concepts](https://o3-docs.openmrs.org/en-US/docs/core-concepts) - Core O3 patterns

## Notification sources

Two are built in, and either can be turned off independently.

- [Extension System](https://o3-docs.openmrs.org/docs/extension-system) - Adding widgets and extensions
- [State Management](https://o3-docs.openmrs.org/en-US/docs/coding-conventions/state-management) - Managing app state
- [Carbon and Styling](https://o3-docs.openmrs.org/en-US/docs/coding-conventions/styling) - UI components and styling
- [Testing](https://o3-docs.openmrs.org/en-US/docs/frontend-modules/unit-and-integration-testing) - Testing your module

`notifications-backend` is recipient-scoped and cross-patient: the server's `NotificationRuleEngine`
decides what exists, and this module renders it and drives the lifecycle. It is **off by default** —
without the backend module installed it would only ever 404.

Both feed **one** inbox, interleaved by severity and then recency, so a clinician reads a single
list rather than two.

### Writing a source

A source is data-only. It never renders: it produces a normalized `SmartNotification` — severity,
title, subtitle, timestamp and a list of labelled `detailFields` — and the core's row and modal
render every source identically. Register it from your own module's `startupApp`:

```ts
import { registerNotificationSource } from '@openmrs/esm-smart-notifications-app';

registerNotificationSource({
  id: 'my-source',
  useNotifications({ patientUuid, userUuid }) {
    // Any hooks you like: each source runs inside its own component.
    return { notifications, isLoading, error, mutate };
  },
  // Optional, for a source with its own server-side lifecycle.
  markRead: (notification) => {
    /* ... */
  },
  markReviewed: (notification, { providerDisplay }) => {
    /* ... */
  },
});
```

The core records read and review state locally either way, so `markRead`/`markReviewed` are only
needed when a source has a backend to mirror the transition to. It writes locally **first** and then
tells the source, so a failing backend cannot un-triage a row a clinician has already dealt with.

See `src/core/types.ts` for the full contract.

## What it does

- **Bell + badge** in the header, showing the unread count across every source.
- **Inbox panel**, rendered into the app shell's own notifications panel, listing what needs
  attention with severity, kind, subject and time.
- **Detail modal** with _Mark as reviewed_ (clears the notification) and _View in chart_ (navigates
  without clearing it — looking is not signing off).
- **Full-page inbox** at `/openmrs/spa/smart-notifications`, reading the same list.
- **Polling**, so the badge updates without a manual refresh.

Opening a notification marks it read — the badge drops — but it stays in the inbox until it is
explicitly reviewed, so glancing at something never makes it disappear.

The bell registers into `notifications-menu-button-slot` and the rows into
`notifications-nav-menu-slot`, both provided by `esm-primary-navigation`.

## Configuration

Under the `@openmrs/esm-smart-notifications-app` config key. Core settings sit at the top level;
everything a source needs lives under `sources.<sourceId>`.

| Key                 | Default | Meaning                                             |
| ------------------- | ------- | --------------------------------------------------- |
| `enabled`           | `true`  | Master switch. When false the bell is not rendered. |
| `pollingIntervalMs` | `30000` | How often to poll. Bounded to 5s–10min.             |

### `sources.labResults`

| Key                           | Default | Meaning                                                                   |
| ----------------------------- | ------- | ------------------------------------------------------------------------- |
| `enabled`                     | `true`  | Surface client-derived lab notifications.                                 |
| `labOrderTypeUuid`            | —       | Order type uuid for lab orders; must match the distro's test-order config. |
| `notifyOnAbnormalNonCritical` | `false` | Also notify for abnormal-but-not-critical values.                         |
| `locationScoped`              | `true`  | Only surface a notification where the order was placed.                   |
| `notificationWindowDays`      | `7`     | How far back a result can be and still notify. `0` disables the bound.    |

### `sources.notificationsBackend`

| Key                 | Default        | Meaning                                                     |
| ------------------- | -------------- | ----------------------------------------------------------- |
| `enabled`           | `false`        | Requires the `notifications` backend module.                |
| `minimumPriority`   | `LOW`          | Lowest priority to surface (`LOW`, `MEDIUM`, `HIGH`).       |
| `notificationTypes` | all four types | `LAB_RESULT`, `PRESCRIPTION`, `SAMPLE_REJECTED`, `GENERAL`. |
| `maxNotifications`  | `50`           | Maximum notifications requested per poll.                   |

## Relationship to the patient chart

Two pieces of chart UI stay in `@openmrs/esm-patient-chart`'s `esm-patient-tests-app`, because they
are chart UI rather than inbox UI:

- the **"Notify me when resulted"** toggle on the test-order form, which depends on that form's live
  urgency field;
- the **"reviewed" receipt** on the Results dashboard.

Both talk to this module through global stores the framework shares by name
(`smart-notifications-opt-in`, `smart-notifications-review`) — see `smart-notifications-bridge.ts`
over there. There is no package dependency in either direction, and if this module is not installed
those two features simply no-op.

## Known limitations

- Latency is bounded by `pollingIntervalMs` — this polls rather than pushes.
- Read, review and opt-in state live in `localStorage`, keyed per user. They are per-browser, not
  shared across devices and not server-audited. A source with its own backend lifecycle mirrors the
  transitions server-side.
- `lab-results` joins observations to orders heuristically (concept + encounter, then timestamp),
  because FHIR lab observations carry no `basedOn` pointing back at the order.
- Critical-tier accuracy for `lab-results` depends on the concept dictionary populating critical
  ranges. Bounds that contradict the normal range are ignored rather than trusted — see
  `withCoherentCriticalBounds`.
- The opt-in is concept-level, not order-level: OpenMRS core has no order attribute to carry it, so
  ordering the same test twice makes both results notify. That errs toward notifying, which is the
  safe direction.

- [OpenMRS Talk](https://talk.openmrs.org/) - Community forum for questions
- [OpenMRS Wiki](https://wiki.openmrs.org/display/RES/OpenMRS+3.x+Dev+Forum) - Join the developer community

## Common tasks

### Adding new routes

See the [routes registry documentation](https://o3-docs.openmrs.org/en-US/docs/core-concepts#routes-registry) for details.


### Development commands

```bash
yarn install
yarn start
```

### Development commands

```bash
yarn test                  # run tests
yarn test:watch            # watch tests
yarn coverage              # tests with coverage
yarn typescript            # type checking
yarn lint                  # linting
yarn extract-translations  # regenerate translations/en.json
yarn build                 # production build
```

## Learn more

- [Getting Started](https://o3-docs.openmrs.org/docs/getting-started)
- [Creating a Frontend Module](https://o3-docs.openmrs.org/docs/frontend-modules/creating-a-frontend-module)
- [Extension System](https://o3-docs.openmrs.org/docs/extension-system)
- [State Management](https://o3-docs.openmrs.org/docs/state-management)
- [OpenMRS Talk](https://talk.openmrs.org/)
