import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidToken, cookieName } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bans or unbans an account via the GoTrue admin API. A ban sets banned_until far in the future;
// the tweak's 1-second heartbeat sees it and locks the app back to the sign-in gate. Unban clears it.
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
  const ban = !!body.ban;
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
    body: JSON.stringify({ ban_duration: ban ? "876000h" : "none" }),
    cache: "no-store",
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json({ ok: false, error: `Supabase ${r.status}: ${text}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
