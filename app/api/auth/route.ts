import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authToken,
  createSessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = authToken();
  if (!expected) {
    return NextResponse.json({ ok: true, message: "auth disabled" });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (body.token !== expected) {
    return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });
  }

  const sessionCookie = await createSessionCookie();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
