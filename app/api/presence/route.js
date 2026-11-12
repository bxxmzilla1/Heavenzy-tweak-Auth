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

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/presence?select=*&order=last_seen.desc`;
  const r = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json({ ok: false, error: `Supabase ${r.status}: ${text}` }, { status: 502 });
  }

  const rows = await r.json();
  return NextResponse.json({ ok: true, rows });
}
