import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidToken, cookieName } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads / flips the signup gate (public.admin_settings.signups_enabled, see supabase/signup_gate.sql).
// When off, the "Before User Created" auth hook rejects every new sign-up until the admin turns it back on.
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    endpoint: `${url.replace(/\/$/, "")}/rest/v1/admin_settings?id=eq.true`,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function supabaseError(r) {
  const text = await r.text();
  const hint = /admin_settings/.test(text) ? " Run supabase/signup_gate.sql in the Supabase SQL editor." : "";
  return NextResponse.json({ ok: false, error: `Supabase ${r.status}: ${text}${hint}` }, { status: 502 });
}

export async function GET() {
  if (!isValidToken(cookies().get(cookieName())?.value)) return unauthorized();
  const c = config();
  if (!c) return NextResponse.json({ ok: false, error: "Supabase env vars are not configured." }, { status: 500 });

  const r = await fetch(`${c.endpoint}&select=signups_enabled`, { headers: c.headers, cache: "no-store" });
  if (!r.ok) return supabaseError(r);
  const rows = await r.json();
  return NextResponse.json({ ok: true, enabled: rows[0]?.signups_enabled !== false });
}

export async function POST(request) {
  if (!isValidToken(cookies().get(cookieName())?.value)) return unauthorized();
  const c = config();
  if (!c) return NextResponse.json({ ok: false, error: "Supabase env vars are not configured." }, { status: 500 });

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const enabled = !!body.enabled;

  const r = await fetch(c.endpoint, {
    method: "PATCH",
    headers: { ...c.headers, Prefer: "return=representation" },
    body: JSON.stringify({ signups_enabled: enabled, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!r.ok) return supabaseError(r);
  const rows = await r.json();
  if (!rows.length) {
    return NextResponse.json(
      { ok: false, error: "Settings row missing. Run supabase/signup_gate.sql in the Supabase SQL editor." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, enabled: rows[0].signups_enabled });
}
