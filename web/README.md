# `web/`

Frontend browser application for LightPath built with React, Vite, and strict TypeScript.

## Features
- Interactive 360° terrain horizon viewer with dynamic observer mast height slider (0m, 2m, 5m, 10m).
- 14-day scrubbable time series with live Sun/Earth illumination status and DTE ground station line-of-sight tracking.
- Interactive space-time route planner displaying terrain slope heatmaps and traversable rover waypoints.
- Web Worker asynchronous route solver (`src/workers/routeWorker.ts`).
- Full provenance audit modal.
- Permanent disclaimer banner and synthetic data warning badge.
- 100% offline at runtime: no network calls in the web app (Rule 8).

## Development
```bash
npm install
npm run dev
```

## Testing & Linting
```bash
npm run test    # Vitest
npm run lint    # ESLint
npm run build   # TypeScript strict check & Vite production build
```
