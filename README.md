<div align="center">

# RevoGrid Pivot

[View live demo](https://pivot.rv-grid.com/demo/) · [Get Pro Advanced](https://rv-grid.com/pricing/)

[![RevoGrid Pivot walkthrough](./assets/pivot-walkthrough.gif)](./assets/pivot-walkthrough.mp4)

</div>

RevoGrid Pivot is a JavaScript pivot table component for embedded analytics.
Turn application data or remote analytical results into interactive dimensions,
aggregations, drill-down views, totals, and linked charts while retaining
RevoGrid's virtualized rendering and extension model.

## Key capabilities

- Configure reusable row, column, value, and filter dimensions
- Aggregate measures with sum, average, minimum, maximum, and custom functions
- Expand and collapse hierarchical groups with subtotals and grand totals
- Filter and sort dimensions directly from generated Pivot headers
- Build linked Pivot charts with a first-party renderer or a headless integration
- Apply conditional formatting and custom column types to analytical values
- Save and restore versioned Pivot layouts and user configuration
- Run locally in the browser or connect the same public configuration model to a server-side analytical engine

## Installation

### Free trial

The public trial registry requires no token or login. Configure it for this
project and install the trial packages under the production import names:

```bash
pnpm config set @revolist:registry https://trial.rv-grid.com --location=project
pnpm add @revolist/revogrid@4.29.0 @revolist/revogrid-pro@npm:@revolist/rv-pro-trial@3.0.12 @revolist/pivot@npm:@revolist/pivot-trial@3.0.12
```

### Pro

Paid users can remove the trial registry override and install the licensed
packages. Source imports stay unchanged.

```bash
pnpm config delete @revolist:registry --location=project
pnpm add @revolist/revogrid@4.29.0 @revolist/revogrid-pro@3.0.12 @revolist/pivot@3.0.12
```

## Quick start

```ts
import { defineCustomElements } from '@revolist/revogrid/loader';
import { PivotPlugin, type PivotConfig } from '@revolist/pivot';
import '@revolist/revogrid-pro/styles.css';
import '@revolist/pivot/styles.css';

defineCustomElements();

const pivot: PivotConfig = {
  dimensions: ['country', 'year', 'sales'].map(prop => ({ prop, name: prop })),
  rows: ['country'],
  columns: ['year'],
  values: [{ prop: 'sales', aggregator: 'sum' }],
  hasConfigurator: true,
};

const grid = document.createElement('revo-grid');
grid.plugins = [PivotPlugin];
grid.pivot = pivot;
grid.style.height = '500px';
const host = document.querySelector('#app');
if (!host) throw new Error('Add <div id="app"></div> to your page.');
host.appendChild(grid);
// Set source after mounting so the plugin has connected to the grid.
grid.source = [
  { country: 'Portugal', year: 2025, sales: 125000 },
  { country: 'Portugal', year: 2026, sales: 148000 },
  { country: 'Spain', year: 2026, sales: 171000 },
];
```

## Framework integrations

The component uses the same configuration model across supported frameworks.

| Framework | Integration source | Start command |
| --- | --- | --- |
| Vanilla TypeScript | [`src/pivot.ts`](./src/pivot.ts) | `pnpm dev` |
| React | [`src/pivot.react.tsx`](./src/pivot.react.tsx) | `pnpm dev:react` |
| Vue 3 | [`src/pivot.vue`](./src/pivot.vue) | `pnpm dev:vue` |
| Angular | [`src/pivot.angular.ts`](./src/pivot.angular.ts) | `pnpm dev:angular` |

Build all integrations with `pnpm build:frameworks`.

## Run the examples

Use **Node 22.22.3 or newer** and **pnpm 10**. The checkout already declares
the exact trial dependencies and registry; no token or manual package edits
are needed to run it:

```bash
git clone https://github.com/revolist/pivot.git
cd pivot
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:5173/](http://localhost:5173/) for the Vanilla TypeScript
version. Use `pnpm dev:react`, `pnpm dev:vue`, or `pnpm dev:angular` for the
matching framework integration. The complete financial-analysis implementation
starts in [`src/pivot.ts`](./src/pivot.ts), with the other framework entry points
linked in the table above. You can also open the [hosted Pivot
example](https://pivot.rv-grid.com/demo/) without running the repository.

The focused Pivot examples are owned by this repository:

| Example | Source | Start command |
| --- | --- | --- |
| Support operations | [`examples/operations`](./examples/operations/) | `pnpm --dir examples/operations dev` |
| Client scale | [`examples/scale`](./examples/scale/) | `pnpm --dir examples/scale dev` |

Run `pnpm install` at the repository root first.

## Find the code for each demo

Start with the entry or component, then edit the data or configuration module
for the part you want to change. Framework wrappers reuse those modules.

| Demo | Local URL after starting its app | UI / entry | Data and configuration |
| --- | --- | --- | --- |
| Main Pivot | `/` | `src/pivot.vue` or `src/pivot.ts` | `src/contoso-data.ts`, `src/financial.pivot.ts` |
| Financial analysis | `/financial.html` | `src/financial-demo.vue` | Same model, initially selects the Profit preset |
| Charts dashboard | `/charts.html` | `src/charts-dashboard.vue` | `src/charts-dashboard.model.ts` |
| Ticket investigation | `/` in Operations | `examples/operations/src/OperationsPivot.vue` | `tickets.ts`, `pivot.ts` in the same directory |
| Client scale | `/` in Scale | `examples/scale/src/scale-demo.ts` | `data.ts`, `pivot-config.ts` in the same directory |

The root app serves Main, Financial and Charts together on Vite's printed URL
(normally port 5173). Focused apps also default to 5173; start one at a time
or use `pnpm --dir examples/operations dev --port 5175`.

For a minimal integration, use **Quick start** above. To reproduce a complete
demo, keep its supporting modules and CSS, or clone this checkout; one framework
component alone is not the whole application. The bundled Contoso asset is
already included, so Python and an external data download are not prerequisites.
Detailed product reports can exceed the chart safety limits. The demo keeps
the table available and asks you to filter data through Fields before charting;
it never silently removes products from the report.
The optional summary-panel enhancement appears when the installed Pro package
exports it; the pinned public trial runs the full report without that panel.

## Adapt with an AI coding assistant

Give your assistant this repository and [`AGENTS.md`](./AGENTS.md), then use a
specific request such as:

> Read AGENTS.md and examples/operations/README.md. Run the Operations demo.
> Adapt its ticket fields to my support data using the installed public Pivot
> types. Run its tests, typecheck and build, then verify the report totals
> against an independent calculation.

Change `examples/operations` to the demo you want. Say which framework and behavior
you need; keep data preparation, Pivot configuration, UI and cleanup in their
existing owners. Each focused README lists those owners and its verification commands.

## Resources

- [Pivot documentation](https://pro.rv-grid.com/guides/pivot/)
- [Pivot configuration reference](https://pro.rv-grid.com/guides/pivot/concepts/configuration-reference)
- [Server-side Pivot](https://pro.rv-grid.com/guides/pivot/server-side/server-side)
- [Trial installation guide](https://pro.rv-grid.com/guides/installation-npm-trial/)

## License

The integration source and supporting assets in this repository are MIT
licensed. RevoGrid Pro and RevoGrid Pivot are commercial packages distributed
under the license supplied with your subscription.

### Theme integration

All demos follow the document’s `dark`/`light` class or `data-theme` attribute, falling back to the operating system preference. `src/shared/theme.ts` owns detection and live updates; hosts dispose its observer when unmounted. Grids use the public `compact` and `darkCompact` themes. Copy the shared helper alongside the focused example when reusing its source.

### Pinned trial build compatibility

The public Pro/Pivot 2.10.0 trial artifacts contain an obfuscation defect: six
Advanced Filter class self-references point to Core BasePlugin. The Vite plugin
in `scripts/trial-filter-identity.mjs` repairs those identifier bindings at build
time for these exact trial versions. It runs for development and production,
preserves evaluator guards and filtering behavior, and leaves corrected bundles
unchanged. `pnpm test:trial-compatibility` checks the repair against both installed
artifacts and rejects unexpected shapes. Remove this compatibility plugin when
upgrading to a corrected trial release. No runtime prototype patch is installed.


## Calculation policy

The finite-number example uses default numeric callbacks. For new reports, use explicit V2 numeric/scalar presets and a persisted execution pin. Default AVG includes null as zero and count counts occurrences; numeric presets skip null/missing and error on invalid input. A pin prevents accidental engine switching, not identical local/server results.

See the [source-verified aggregation guide](https://pro.rv-grid.com/guides/pivot/concepts/aggregations/) and [safe saved-report configuration](https://pro.rv-grid.com/guides/migrations/#pivot-calculation-policies-and-saved-reports). Keep this standalone workspace's installed reader/API version in view before copying configuration from another release.
