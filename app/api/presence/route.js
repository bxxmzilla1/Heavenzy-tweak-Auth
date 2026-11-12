import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidToken, cookieName } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(cookieName())?.value;
  if (!isValidToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase env vars are not configured." }, { status: 500 });
  }

  const base = url.replace(/\/$/, "");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const r = await fetch(`${base}/rest/v1/presence?select=*&order=last_seen.desc`, {
    headers,
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json({ ok: false, error: `Supabase ${r.status}: ${text}` }, { status: 502 });
  }
  const rows = await r.json();

  // Merge ban status from the GoTrue admin users list (banned_until lives in the auth schema).
  const bannedById = {};
  try {
    const ur = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1000`, { headers, cache: "no-store" });
    if (ur.ok) {
      const uj = await ur.json();
      const users = Array.isArray(uj) ? uj : uj.users || [];
      for (const u of users) {
        const until = u.banned_until ? new Date(u.banned_until).getTime() : 0;
        bannedById[u.id] = until > Date.now();
      }
    }
  } catch {}

  for (const row of rows) {
    row.banned = !!bannedById[row.user_id];
  }

  return NextResponse.json({ ok: true, rows });
}
