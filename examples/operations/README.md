# Support operations Pivot

Focused Vue demo of support-ticket volume, average resolution time, SLA breaches, and source-record investigation. The synthetic 480-ticket fixture is deterministic and contains no customer information.

Select a team or priority to filter the Pivot and the source ticket grid together. The RevoGrid detail view lists the exact records in the selected scope, with scrolling and 15-record pages controlled by `PaginationPlugin`. Focus a Pivot value cell, then choose **Inspect focused value cell** to show the matching records from that same filtered source. Public Pivot row and column metadata define the focused cell's scope. The detail panel identifies whether it shows the selected scope or a Pivot cell.

Run `pnpm test`, `pnpm build`, or `pnpm dev` from this package. The source also includes Vanilla TypeScript, React, and Angular embed variants used by the docs.
