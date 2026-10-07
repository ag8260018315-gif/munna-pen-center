# Setting up Supabase — click by click

You do this yourself in your browser. **No password or key is ever sent to anyone** — you paste three pieces of SQL into Supabase, and put one connection string into Vercel.

Screens change now and then, so a button may be named slightly differently. If something does not match, send a screenshot (hide any password) and ask.

## What each file is

| File in the project | What it does |
| --- | --- |
| `prisma/migrations/0001_init/migration.sql` | Builds the 19 tables, links, rules and security. Reviewed in `docs/MIGRATION_0001_REVIEW.md` |
| `prisma/tests/migration-checks.sql` | A self-test: tries to break the rules and confirms they hold. Saves nothing |
| `prisma/seed/catalogue.sql` | Loads **only what you supplied**: 23 categories, 20 brands, 5 products. No prices, SKUs, GST, HSN or stock |

To copy a file from GitHub: open it on github.com, click the **Raw** button, press Ctrl+A then Ctrl+C.

## A. Create the project (5 minutes)

1. Go to supabase.com, sign in, and click **New project**.
2. Name: `munna-pen-center`. Region: **Mumbai (ap-south-1)** if offered, otherwise the nearest.
3. **Database password:** use a long one made only of **letters and numbers** (no `@ : / # % ? &`). Special characters break the connection string later. Save it in a password manager. Click **Create new project** and wait about two minutes.
4. Optional but recommended: **Project Settings → Data API** → turn the Data API **off**. This site does not use it, and the migration already blocks it.

## B. Build the tables (3 pastes)

Open **SQL Editor** (left menu) → **New query**. For each paste below: paste, click **Run**, read the result.

1. **`migration.sql`** → expect *"Success. No rows returned"*.
   If Supabase warns about "destructive operations", it is fine to continue: that file only creates things.
2. **`migration-checks.sql`** → expect one result row: **ALL MIGRATION CHECKS PASSED**.
   Then run this to confirm nothing was left behind (all three numbers must be 0):
   ```sql
   select (select count(*) from "Product") as products, (select count(*) from "Lead") as leads, (select count(*) from "AdminUser") as admins;
   ```
   The self-test contains `DELETE` statements (it tries to delete things to prove they are protected), so Supabase may show the same warning; continue.
   **If it fails**, stop and send me the error text. Do not continue.
3. **`catalogue.sql`** → the last row should show **categories 23, brands 20, products 5**. Running it a second time changes nothing.

## C. Connect the website (5 minutes)

1. In Supabase click **Connect** (top bar) → copy the **Transaction pooler** connection string. It looks like `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-….pooler.supabase.com:6543/postgres`.
2. Replace `[YOUR-PASSWORD]` with your database password (no brackets).
3. In **Vercel → your project → Settings → Environment Variables** add:
   - Key: `DATABASE_URL`
   - Value: the string from step 2
   - Environments: tick **Production** and **Preview**
   - Turn **Sensitive** on, then **Save**.
4. That is the only variable needed now. (`DIRECT_URL` is only for running migrations from a computer, which we are not doing. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are for product-photo uploads, which are not built yet — do not add keys nothing uses.)
5. **Deployments** → open the newest deployment from `main` → `⋯` → **Redeploy**. A new variable only takes effect on a new deployment.

## D. Test it

1. On the live site open **Request Quote**, fill the form with obviously fake details (name "Test Person", phone 98765 43210) and send.
2. You should see a green confirmation with a reference like `ENQ-2026…`.
3. In Supabase: **Table Editor → Enquiry**. Your test enquiry is there, and the person is in **Lead**.
4. Delete the test: in **Enquiry** select the row → delete; then in **Lead** delete the test lead.

**If you see the red "could not save" panel with a WhatsApp button instead:** the database address is wrong or unreachable. Vercel → the deployment → **Logs**, search for `[enquiry]`, and send me that line (check it contains no password first). The most common causes: a special character in the password, the wrong tab copied (use *Transaction pooler*), or the `[YOUR-PASSWORD]` placeholder left in. If it mentions a *self-signed certificate*, tell me — I will fix it in code; do not turn security off.

## E. Show the catalogue from the database (later)

Only when you are ready to manage products there (the admin screens are not built yet): add `CATALOGUE_SOURCE` = `database` in Vercel and redeploy. If the site ever looks empty, delete that variable and redeploy — it goes straight back to the built-in list.

## Good to know

- **Free Supabase projects pause after about a week without activity**, and a paused database means enquiries fall back to WhatsApp. Before you launch for real, upgrade to a paid plan (it also adds backups) or visit the project regularly.
- The migration was applied by hand, so Prisma does not know about it. Before we ever run `prisma migrate` from a computer, I will mark it as applied (`prisma migrate resolve --applied 0001_init`).
- Treat Supabase dashboard access as owner-level: anyone who can open the SQL Editor can change anything, including turning the safety rules off.
- I will never ask you for the database password, the service-role key or the connection string.
