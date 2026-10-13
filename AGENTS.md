# Working on the Pivot demos

Read README.md first. This is a standalone pnpm workspace; no parent RevoGrid
monorepo or docs checkout is required to run the examples. Use Node >=22.22.3
and pnpm 10. Install from the root with `pnpm install --frozen-lockfile`.
The committed registry and exact trial aliases need no authentication token.

## Choose the existing owner

- Main and Financial: framework entry points in `src/pivot.*`; shared public
  plugin configuration/presets in `src/financial.pivot.ts`, bundled data loader
  in `src/contoso-data.ts`, save/restore logic in `src/financial.analytics.ts`,
  actions/exports in `src/financial.actions.ts`. Financial selects an initial
  preset through `src/financial-demo.*` rather than copying the report.
- Charts: `src/charts-dashboard.vue` owns UI and lifecycle;
  `src/charts-dashboard.model.ts` owns filters, configuration and reconciliation.
  Framework hosts call `src/charts-mount.ts` and share the same dashboard.
- Operations: `examples/operations/src/OperationsPivot.vue` owns UI;
  `tickets.ts` owns synthetic source data and matching; `pivot.ts` owns config.
- Client scale: `examples/scale/src/scale-demo.ts` owns measurements/lifecycle;
  `data.ts` owns generation; `pivot-config.ts` owns config.


## Keep adaptations small and runnable

Use installed public exports/types for Pivot, Pro and Core; do not invent APIs
or import private monorepo paths. Preserve exact dependency versions unless the
task requests an upgrade. Configure grid properties, events and plugin APIs
instead of patching internal grid DOM. Mount a grid before assigning its source.
Return/call cleanup when embedding a demo, and dispose listeners, charts and
pending work with its host. Keep related framework wrappers in sync.

Prefer named helpers at existing data/config/UI boundaries. Add comments for
non-obvious contracts (mount order, null handling, races, timing); avoid narration
of every assignment. Keep required CSS and assets with copied examples.

## Verify the changed demo

- Main/Financial/Charts: `pnpm test`, `pnpm build:frameworks`.
  `pnpm test:e2e` runs browser coverage (requires Playwright Chromium installed).
- Focused examples: `pnpm --dir examples/<name> test`, then `typecheck` and `build`.
  Names are `operations`, `scale`.
- Preview the changed flow in a browser. For imported data, check every result,
  row/column/grand total against an independent calculation, including blanks,
  negative amounts and decimals. Do not call a build a browser verification.

The docs gallery is a separate consumer. If working there too, keep its source
file registry complete whenever extracting or adding a supporting module.
Report local checks and deployed checks separately.
