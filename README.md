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
pnpm i @revolist/revogrid-pro@npm:@revolist/rv-pro-trial@2.7.10 @revolist/pivot@npm:@revolist/pivot-trial@2.7.10
```

### Pro

Paid users can remove the trial registry override and install the licensed
packages. Source imports stay unchanged.

```bash
pnpm config delete @revolist:registry --location=project
pnpm i @revolist/revogrid-pro@2.7.10 @revolist/pivot@2.7.10
```

## Quick start

```ts
import { defineCustomElements } from '@revolist/revogrid/loader';
import { PivotPlugin, type PivotConfig } from '@revolist/pivot';
import '@revolist/pivot/styles.css';

defineCustomElements();

const pivot: PivotConfig = {
  rows: ['country'],
  columns: ['year'],
  values: [{ prop: 'sales', aggregator: 'sum' }],
  hasConfigurator: true,
};

const grid = document.createElement('revo-grid');
grid.plugins = [PivotPlugin];
grid.pivot = pivot;
document.querySelector('#app')?.appendChild(grid);
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

Clone the component repository, follow either the **Free trial** or **Pro**
installation above, and start the framework you want to inspect:

```bash
git clone https://github.com/revolist/pivot.git
cd pivot
pnpm dev
```

Open [http://localhost:5173/](http://localhost:5173/) for the Vanilla TypeScript
version. Use `pnpm dev:react`, `pnpm dev:vue`, or `pnpm dev:angular` for the
matching framework integration. The complete financial-analysis implementation
starts in [`src/pivot.ts`](./src/pivot.ts), with the other framework entry points
linked in the table above. You can also open the [hosted Pivot
example](https://pivot.rv-grid.com/demo/) without running the repository.

## Resources

- [Pivot documentation](https://pro.rv-grid.com/guides/pivot/)
- [Pivot configuration reference](https://pro.rv-grid.com/guides/pivot/concepts/configuration-reference)
- [Server-side Pivot](https://pro.rv-grid.com/guides/pivot/server-side/server-side)
- [Trial installation guide](https://pro.rv-grid.com/guides/installation-npm-trial/)

## License

The integration source and supporting assets in this repository are MIT
licensed. RevoGrid Pro and RevoGrid Pivot are commercial packages distributed
under the license supplied with your subscription.
