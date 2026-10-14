# Support operations Pivot

## Run from a fresh checkout

Use Node >=22.22.3 and pnpm 10. From the Pivot repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir examples/operations dev
```

Open Vite's printed URL (normally http://localhost:5173/). You should see 480
synthetic tickets. Choose a team/priority, then inspect a Pivot value cell to
compare its total with the matching source tickets. No backend or account is needed.

## Where to change the code

| Concern | File in `src/` |
| --- | --- |
| Filters, Pivot and source-ticket detail panel | `OperationsPivot.vue` |
| Deterministic tickets, filtering and cell-to-record matching | `tickets.ts` |
| Dimensions, measures and aggregators | `pivot.ts` |
| Shared mount/unmount lifecycle | `operations-demo.ts` |
| Framework hosts | `OperationsDemo.vue`, `OperationsDemo.ts`, `OperationsDemo.tsx`, `OperationsDemoAngular.ts` |

Adapt your ticket fields in `tickets.ts` and `pivot.ts` together. Keep unresolved
resolution hours blank so averages count only resolved tickets. All hosts share
the Vue workspace, which owns filtering and inspection; copy its supporting
files and styles rather than one wrapper alone.
The standalone entry point `main.ts` imports the repository's `demo-host.css`
for page sizing. Embedded framework hosts use their application's page styles;
the shared mount module imports only component styles.

## Verify

From the repository root, run `pnpm --dir examples/operations test`,
`pnpm --dir examples/operations typecheck` and `pnpm --dir examples/operations build`.

## Behavior

Focused Vue demo of support-ticket volume, average resolution time, SLA breaches, and source-record investigation. The synthetic 480-ticket fixture is deterministic and contains no customer information.

Select a team or priority to filter the Pivot and the source ticket grid together. The RevoGrid detail view lists the exact records in the selected scope, with scrolling and 15-record pages controlled by `PaginationPlugin`. Focus a Pivot value cell, then choose **Inspect focused value cell** to show the matching records from that same filtered source. Public Pivot row and column metadata define the focused cell's scope. The detail panel identifies whether it shows the selected scope or a Pivot cell.

Run `pnpm test`, `pnpm build`, or `pnpm dev` from this package. The source also includes Vanilla TypeScript, React, and Angular embed variants used by the docs.
