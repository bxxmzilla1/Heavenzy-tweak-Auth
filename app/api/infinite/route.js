import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidToken, cookieName } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Grants or revokes Infinite access. The flag lives in the user's app_metadata (only the service role
// can write it, and GoTrue merges the key into existing app_metadata). The tweak and Dazey read it from
// their 1-second /auth/v1/user check: with it on, the single-device lock and session-expiry sign-outs
// are skipped, so only a ban ends the session.
export async function POST(request) {
  const token = cookies().get(cookieName())?.value;
  if (!isValidToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const userId = body.user_id;
  const infinite = !!body.infinite;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing user_id" }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase env vars are not configured." }, { status: 500 });
  }

  const endpoint = `${url.replace(/\/$/, "")}/auth/v1/admin/users/${userId}`;
  const r = await fetch(endpoint, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app_metadata: { infinite } }),
    cache: "no-store",
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json({ ok: false, error: `Supabase ${r.status}: ${text}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
