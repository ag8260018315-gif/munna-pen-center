# Deploying to Vercel — step by step

## 1. Which code gets deployed
- Vercel builds a **commit** of a **branch**. Every `git push` to a connected branch creates a **new deployment** by itself.
- **"Redeploy" on an old deployment rebuilds the SAME old commit.** It does not pick up newer code. To get new code, open the newest deployment in the list (check its commit message and hash), or push a new commit.
- Project → Settings → Git → **Production Branch** decides which branch becomes the live site. Today the work lives on `claude/munna-pen-center-website-4l2tif`; once it is merged, set the Production Branch to `main`.

## 2. Environment variables (Project → Settings → Environment Variables)
Mark everything except `NEXT_PUBLIC_SITE_URL` as **Sensitive**. Paste only the value — **no quotes, no `NAME=`, no label**.

| Name | When | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | always | Your real address, e.g. `https://www.yourdomain.in` (the build warns if it is missing or `localhost`) |
| `BUSINESS_GSTIN` | not needed yet | The 15-character GSTIN, for invoices later. **The website never shows it** (it says only "GST Registered"). If set but mistyped, a warning is logged — it never breaks the build. You can leave it out for now |
| `DATABASE_URL` | once Supabase exists | Supabase **pooled** connection string |
| `DIRECT_URL` | once Supabase exists | Supabase **direct** connection string (migrations only) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | once Supabase exists | Server-side only; the service-role key must never be shared or committed |
| `CATALOGUE_SOURCE` | later | Leave unset (built-in catalogue) until real products are loaded; then `database` |

Changing a variable does **not** change an existing deployment — create a new deployment afterwards.

Database setup (Supabase) is a separate click-by-click guide: [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md).

## 3. Reading a failed build
Open the deployment → **Build Logs** and read from `Collecting page data` or `Running TypeScript` down to the red lines.

| You see | Meaning | Fix |
| --- | --- | --- |
| `Invalid environment configuration. Check: NAME` | The variable `NAME` has a value of the wrong kind (e.g. a URL variable that is not a URL) | Re-enter it: value only, no quotes or label. (`BUSINESS_GSTIN` no longer causes this) |
| `[config] BUSINESS_GSTIN is set but is not a valid GSTIN` | A warning, not an error | Enter just the 15 characters |
| `NEXT_PUBLIC_SITE_URL is not set / a local address` | A warning | Set your real domain |
| Errors mentioning `prisma generate` | Dependencies did not install fully | Check the install step above the error |

## 4. After the first successful deploy
Run `npm run smoke -- https://your-vercel-address` from a computer with the project, and open the site on a phone.
