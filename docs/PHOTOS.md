# Product pictures — one-time setup (about 10 minutes)

Pictures are uploaded in the admin (*Products → open a product → Picture*) and stored in **Supabase Storage**. You do this once, in your browser. **Never send the service-role key to anyone — not to me, not by chat or e-mail.**

## 1. Create the bucket (Supabase)

1. Open your Supabase project → **Storage** (left menu) → **New bucket**.
2. Name: `product-images` (exactly).
3. Turn **Public bucket** ON. (Product pictures are public on your website anyway; "public" only means people can *view* a picture if they have its address. Nobody can upload or delete.)
4. Leave the size limit and file-type boxes empty (the admin already limits size and type), and press **Create**.
5. Do **not** add any policies. Without a policy, only your server — using the service-role key — can upload.

## 2. Copy two values (Supabase)

Project Settings → **API** (or *Data API*):
- **Project URL** — looks like `https://abcdxyz.supabase.co`.
- **service_role** key under *Project API keys* (press *Reveal*). This key can do anything in your project: treat it like a password.

## 3. Add them to Vercel

Vercel → project `munna-pen-center` → *Settings → Environment Variables*. Add, for **Production** (and Preview if you test there):

| Name | Value | Sensitive |
| --- | --- | --- |
| `SUPABASE_URL` | the Project URL | off is fine |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key | **ON** |
| `SUPABASE_STORAGE_BUCKET` | only if you named the bucket something other than `product-images` | off |

Paste only the value — no quotes, no `NAME=`. Then open *Deployments*, take the newest `main` deployment → `⋯` → **Redeploy**. (`SUPABASE_URL` is also read when the site is built, to allow pictures from your Supabase address, so a new deployment is required.)

## 4. Use it

Admin → Products → open a product → **Picture** → choose a photo → describe it in a few words (e.g. "Blue ball pen, box of 10") → **Upload picture**. It appears on the website straight away.

If the panel says *Picture storage is not set up yet*, one of the Vercel values is missing or the site was not redeployed after adding it.

## What the system does to every picture

- **Your browser shrinks each picture first** (to at most 1600 pixels, saved as WebP). The website host refuses any single upload over 4.5 MB, and phone or AI-made pictures are often bigger, so this makes every upload small and fast. You can choose pictures up to 30 MB.
- Only real JPG, PNG or WebP pictures are accepted — a renamed file, an SVG, a GIF or a PDF is refused.
- It is re-saved as a WebP, at most 1200 pixels on the long side. Hidden camera data (such as the GPS location of your shop or home) is removed.
- Replacing or removing a picture deletes the old file.
- The description is required: it is read aloud to blind visitors and used by search engines.

## Taking good photos

Daylight, plain light background, one product (or one pack) per photo, label facing the camera, hold the phone steady and square-on. Do not use photos you do not own: pictures from brand websites, Amazon or IndiaMART belong to someone else. Ask the brand or distributor for permission in writing if you want to use theirs.
