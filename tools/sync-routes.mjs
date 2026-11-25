/**
 * Generates the `routes.registry.json` that `openmrs develop` reads from the project root.
 *
 * The backend publishes its registry wrapped as `{"routes": {"<app>": {...}}}`, but the app
 * shell expects a flat map keyed by package name (see `registerApp` in
 * `@openmrs/esm-app-shell/src/run.ts`). The CLI merges the two by spreading them at the same
 * level, which nests every published app one level too deep and leaves the shell with nothing
 * to register — a blank page, with no error. Writing an already-unwrapped registry here means
 * the CLI reads this file verbatim and the merge comes out flat.
 *
 * Usage: yarn sync-routes [backend]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backend = (process.argv[2] ?? 'https://dev3.openmrs.org').replace(/\/$/, '');
const source = `${backend}/openmrs/spa/routes.registry.json`;
const target = resolve(import.meta.dirname, '..', 'routes.registry.json');

const response = await fetch(source);

if (!response.ok) {
  console.error(`Failed to fetch ${source}: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const registry = await response.json();
const routes = registry?.routes ?? registry;

if (!routes || typeof routes !== 'object' || Array.isArray(routes)) {
  console.error(`${source} did not return a routes registry.`);
  process.exit(1);
}

// Guard against writing a registry the CLI would reject and silently skip.
const invalid = Object.entries(routes).filter(
  ([, value]) => !value || typeof value !== 'object' || Array.isArray(value),
);

if (invalid.length) {
  console.error(`Registry contains ${invalid.length} malformed entries: ${invalid.map(([key]) => key).join(', ')}`);
  process.exit(1);
}

writeFileSync(target, `${JSON.stringify(routes, null, 2)}\n`);

console.log(`Wrote ${Object.keys(routes).length} app routes from ${backend} to routes.registry.json`);
