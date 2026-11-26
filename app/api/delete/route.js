import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidToken, cookieName } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Permanently deletes an account via the GoTrue admin API. Its presence row, saved containers and API key
// cascade with it. A device still signed in gets a 403 on its next 1-second /auth/v1/user check and is
// sent back to the sign-in screen.
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
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid user_id" }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Supabase env vars are not configured." }, { status: 500 });
  }

  const r = await fetch(`${url.replace(/\/$/, "")}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!r.ok && r.status !== 404) {
    const text = await r.text();
    return NextResponse.json({ ok: false, error: `Supabase ${r.status}: ${text}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
