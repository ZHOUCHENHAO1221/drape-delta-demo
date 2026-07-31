# DRAPE △ DELTA — live demo (real upload / download)

A deploy-ready copy of the prototype with a **genuinely working file-intake demo**: static site + Netlify Functions + Netlify Blobs (persistent object store). Uploads really persist and download back — framed honestly as **candidates pending review**, not registered measured assets, and no delta is produced (that's the offline step).

Free tier is enough. It costs nothing at rest (functions only run when hit), so "shut it down when not using" = it just sits idle for free.

```
_netlify_demo/
├── index.html            ← panel (primary), with the live layer
├── mobile.html           ← phone companion (/mobile)
├── live.js               ← turns the upload dropzone into a real uploader + asset list
├── netlify.toml          ← publish dir + functions config
├── package.json          ← @netlify/blobs dependency
└── netlify/functions/
    ├── upload.mjs         ← POST: store file in Blobs (25 MB cap; optional passphrase)
    ├── list.mjs           ← GET: list uploaded candidates
    └── download.mjs       ← GET ?key=…: download a stored file
```

## Deploy — you must do this (I can't sign in to your Netlify account)

### Option A — Netlify CLI (fastest)
```bash
cd _netlify_demo
npm install
npm i -g netlify-cli        # if not installed
netlify login              # opens your browser — you authenticate
netlify deploy --prod      # first run: choose "create & configure a new site"
```

### Option B — Git (auto-builds on push)
Push this folder to a GitHub repo → Netlify → **Add new site → Import from Git** → pick the repo. Netlify runs `npm install` and bundles the functions automatically. Publish dir `.`, functions dir `netlify/functions` (already in `netlify.toml`).

### Option C — drag-and-drop (NOT recommended here)
Drag-drop does **not** run `npm install`, so `@netlify/blobs` won't be bundled and the functions will fail. Use A or B.

## Test it works
1. Open the deployed URL → click through to the panel → **My fabric isn't here → Already measured elsewhere?**
2. The dropzone reads **"Live file-intake demo · candidates pending review"**. Click it, pick any small file (a `.zfab`, a CSV, a text file).
3. You'll see **"✓ received & stored as a candidate …"**, and it appears in **Uploaded candidates** with a working **download ↓** link. Reload the page — it's still there (persisted in Blobs).

Locally you can test with `netlify dev` (Blobs works in dev too).

## Lock the public upload (optional)
The upload endpoint is open by default (fine for a controlled demo you share the URL of). To require a passphrase:
- In the Netlify site: **Site configuration → Environment variables → add `DRAPE_PASS` = your-passphrase**, redeploy.
- The page will then prompt for the passphrase on first upload.

## Integrity note
This demo proves the **plumbing** (real upload/download/persistence). It deliberately does **not** claim to register a measured asset or compute a delta — provenance review, a named baseline and a garment comparison remain offline steps. Same integrity contract as the frozen prototype.
