# Heavenzy Admin

A PWA world map showing, in real time, where each account running the **Heavenzy Auth** tweak is
currently active. Markers are green when the account checked in within the last 2 minutes, grey
otherwise. Click a marker for the email, app, device, city/country, IP, and last-seen time.

It reads the `presence` table that the tweak writes to in your Supabase project.

---

## 1. One-time Supabase setup

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.

That creates the `presence` table, the row-level-security policies (each account can only touch its
own row), and the trigger that keeps `last_seen` / `claimed_at` fresh.

> The tweak already points at your Supabase project (`BXAuthConfig.h`). The device-lock and the
> location heartbeat use the same project with the signed-in user's token.

## 2. Push to GitHub

From this `heavenzy-admin` folder:

```bash
git init
git add .
git commit -m "Heavenzy admin map"
git branch -M main
git remote add origin https://github.com/<you>/heavenzy-admin.git
git push -u origin main
```

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `heavenzy-admin` repo.
2. Framework preset: **Next.js** (auto-detected). No build settings to change.
3. Add **Environment Variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | `https://bpcgatpyzzhojgfstcgw.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | *Supabase → Settings → API → `service_role` secret* |
   | `ADMIN_CODE` | *a strong code you'll type to open the map* |

4. Click **Deploy**. Open the URL, enter your `ADMIN_CODE`, and the map loads.

> The service-role key is used **only** in server-side API routes (`/api/presence`) and is never sent
> to the browser. The admin code is verified server-side; the browser only ever holds an opaque
> httpOnly session cookie.

## 4. Install as an app (optional)

Open the deployed URL on your phone → Share → **Add to Home Screen**. It runs full-screen as a PWA.

---

## How the device-lock works

- On login (and on every launch while signed in) the tweak **upserts one row** keyed on the account's
  `user_id`, writing *this* device's `device_id`.
- Every ~20s each device re-reads that row. If the stored `device_id` is no longer its own, it means a
  newer device signed in, so the older device is **signed out immediately** and the login gate
  reappears with "signed in on another device".
- Net effect: **one active device per account at a time**, newest login wins.

## Local development

```bash
cp .env.example .env.local   # fill in the three values
npm install
npm run dev                  # http://localhost:3000
```
