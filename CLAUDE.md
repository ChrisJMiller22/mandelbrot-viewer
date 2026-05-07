# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

There are no tests or linters configured.

## Architecture

The app is a React + Vite + TypeScript fractal viewer with four fractal types: Mandelbrot, Burning Ship, Tricorn, and Julia.

**Data flow:**
- `App.tsx` owns all state: which fractal is active, per-fractal `Viewport` records, and the Julia `c` parameter. It passes viewport and callbacks down to `MandelbrotCanvas`.
- `MandelbrotCanvas.tsx` handles all user interaction (drag-to-zoom, click-to-pick) and owns the render lifecycle. On each render it posts a message to the web worker and updates the canvas when the result comes back.
- `mandelbrot.worker.ts` runs entirely off the main thread. It receives a `RenderRequest`, computes escape-time values for every pixel, applies a cosine colour palette, and transfers the pixel buffer back.

**Viewport coordinates are strings, not numbers.** `Viewport.{xCenter, yCenter, xRange}` are decimal strings to preserve arbitrary precision across zoom levels. `Decimal.js` is used wherever arithmetic on these values is needed.

**Two rendering modes in the worker:**
1. Standard float-64 — used when `xRange >= 1e-11`. All four fractal types are supported.
2. High-precision perturbation theory — kicks in automatically when `xRange < 1e-11` (Mandelbrot and Julia only). A single reference orbit is computed at arbitrary precision using `Decimal.js`, then each pixel is computed as a small perturbation `ε` from that orbit using float-64 arithmetic. The required decimal precision is derived dynamically from zoom depth (`hpPrec`).

**Stale-render prevention:** `MandelbrotCanvas` increments `latestIdRef` on every render call and discards worker results whose `renderId` doesn't match — so only the most recent request is ever drawn.

**Julia pick mode:** When the user clicks "Pick from Mandelbrot", `App` temporarily switches the active fractal to Mandelbrot and passes an `onPick` callback. A click on the canvas converts pixel coordinates back to complex-plane coordinates and sets the Julia `c` parameter.
