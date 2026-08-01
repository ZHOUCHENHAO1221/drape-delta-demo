# DRAPE △ — real accounts (Supabase) setup

Accounts are **optional and off by default**. Until you fill in Supabase values the site
runs in open mode (anonymous upload/delete). Once wired: contributors sign in (email
magic-link or Google), every upload is owned by a real account, and **only the owner can
delete their own uploads**. Cost at demo scale: **£0** (Supabase free tier). No Apple.

## 1 · Create a free Supabase project (~5 min)
1. Go to **supabase.com** → sign up (free) → **New project** (pick any name + a DB password).
2. When it's ready: **Project Settings → API**. Copy two PUBLIC values:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (the long `eyJ...` key — this one is meant to be public)

## 2 · Put them in TWO places
**a) Client** — edit `supabase-config.js` (public values, safe to commit):
```js
window.DRAPE_SUPABASE = {
  url: 'https://abcd1234.supabase.co',
  anonKey: 'eyJ...your-anon-key...'
};
```
**b) Server** — Netlify dashboard → your site → **Site configuration → Environment variables**, add:
- `SUPABASE_URL` = `https://abcd1234.supabase.co`
- `SUPABASE_ANON_KEY` = `eyJ...your-anon-key...`

Then push (`supabase-config.js`) and redeploy. Auth turns on automatically.

## 3 · Email magic-link — works immediately
Nothing else to do. A contributor types their email → "email me a link" → clicks the link
in their inbox → signed in. (Supabase's built-in email works for testing. For a heavier
demo, set your own SMTP in Supabase → Authentication → Emails.)

## 4 · Google login — optional, free, ~15 min
1. **Google Cloud Console** → create a project → **APIs & Services → Credentials → Create
   OAuth client ID → Web application**.
2. Authorised redirect URI: `https://abcd1234.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** + **Client secret**.
4. Supabase → **Authentication → Providers → Google** → enable → paste the two values → save.
   The "Continue with Google" button then works. (Google does not charge for OAuth.)

## 5 · Redirect URL
Supabase → **Authentication → URL Configuration** → add your site URL
(`https://drape-delta.netlify.app`) to **Site URL** / **Redirect URLs**, so magic-link and
Google return to the right place.

---

- **Apple login is intentionally not included** — "Sign in with Apple" needs an Apple
  Developer membership (**$99/year**); not worth it for this demo.
- Storage stays on Netlify Blobs; Supabase only provides identity. Seed fabrics are baked
  into the HTML and are never affected by uploads or deletes.
- No secrets live in the repo — the anon key is public by design; the server env vars are
  set in Netlify, not committed.
