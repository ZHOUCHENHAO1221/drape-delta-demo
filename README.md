# DRAPE △ DELTA

A **measured digital-material workspace** for CLO3D. It organises fabric that has been physically measured and shows how far a named generic CLO3D preset sits from that measured input — as a generic-vs-measured *before/after* on the garment.

Two builds of the same workspace ship here:
- **`index.html`** — the CLO3D side-panel concept (desktop).
- **`mobile.html`** — a phone companion (`/mobile`).

Each is a self-contained single file (fonts, data, images and a 3D displacement point-cloud are embedded — it runs offline). The `netlify/functions` + [Netlify Blobs](https://docs.netlify.com/blobs/overview/) turn the "Already measured elsewhere?" panel into a working **file-intake demo** (upload / list / download that really persists).

## What this is — and is not

This is an **exploratory, single-engine pilot**, not a product or a validated measurement tool.

- Every value shown is a **generic-vs-measured difference computed within CLO3D — not an error against physical reality.**
- One solver (CLO3D 2026.0.374, PD 10), 7 measured specimens, no physical ground-truth validation; cantilever bending is non-standard and stretch is a proxy index.
- Generic preset thickness is a constant 0.50 mm placeholder across presets, so part of every thickness delta reflects that default.
- The upload path is a **future import concept**: an uploaded file is a *candidate pending provenance review* — it is not derived from a photo, and a named baseline + garment comparison are still required before any delta record. It does not register a measured asset.

Headline numbers (verified against the project's before/after log): G1 drape mean delta **24.5 mm** (median **12.0 mm**, robust; the mean is inflated by one high-stretch outlier — P15 jersey, whose own mean is 95 mm and whose largest single vertex is 134 mm); G2 fitted mean **10.1 mm**.

## Deploy

Static site + serverless functions + Netlify Blobs — see **[README_DEPLOY.md](./README_DEPLOY.md)**. In short: connect this repo in the Netlify UI (**Add new site → Import from Git**); Netlify runs `npm install` and bundles the functions automatically (config is in `netlify.toml`).

## Author

Chenhao Zhou · MA Innovative Fashion Production · London College of Fashion, UAL · 2026.
Licensed under the [MIT License](./LICENSE).
