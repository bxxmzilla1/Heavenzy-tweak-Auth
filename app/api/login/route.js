import { NextResponse } from "next/server";
import { codeMatches, sessionToken, cookieName } from "../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {}
  if (!process.env.ADMIN_CODE) {
    return NextResponse.json({ ok: false, error: "ADMIN_CODE is not configured on the server." }, { status: 500 });
  }
  if (!codeMatches(body.code)) {
    return NextResponse.json({ ok: false, error: "Incorrect code." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
