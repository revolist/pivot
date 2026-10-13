# Pivot at scale

## Run from a fresh checkout

Use Node >=22.22.3 and pnpm 10. From the Pivot repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir examples/scale dev
```

Open Vite's printed URL (normally http://localhost:5173/) for the client demo.
It starts with 10K rows; 100K and 1M are explicit choices.

## Where to change the code

| Concern | File |
| --- | --- |
| Client entry and workload UI | `src/main.ts`, `src/scale-demo.ts` |
| Dimensions and measures | `src/pivot-config.ts` |
| Synthetic transaction generation | `src/data.ts` |

Change field names in the generator and config together.
Keep model-event timing and cleanup in the mount functions;
each framework host calls the same implementation and its cleanup callback.
Run `pnpm --dir examples/scale test`, `typecheck` and `build` from the repository
root (repeat the prefix for each command).

## Behavior and measurement

This standalone showcase demonstrates the published `@revolist/pivot` trial package with deterministic synthetic USD transactions. Start with 10K rows, explicitly choose 100K or 1M, and use **Switch row hierarchy** to measure a follow-up interaction. The 1M workload is opt-in because browsers can exhaust memory on smaller devices.

Run `pnpm install`, then `pnpm dev` for the client workload demo. It runs entirely in the browser and needs no backend.

The displayed timings distinguish generation, source/config assignment to `pivot-model-changed`, the following two animation frames, and a later layout interaction. The Pivot interval includes browser scheduling and plugin work; the animation frame interval is a paint estimate. Measurement limits appear in the metric tooltips. Compare runs on the same browser/device and note that the demonstration does not claim a speed advantage over another product.

Run `pnpm test`, `pnpm typecheck`, and `pnpm build` to verify the standalone example. Source rows are generated locally; no imported user data or telemetry leaves the browser.
