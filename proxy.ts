import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, isValidBearer, isValidSessionCookie } from "@/lib/auth";

const PUBLIC_PATHS = new Set<string>(["/login", "/api/auth", "/api/widget"]);
const STATIC_ASSET = /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|woff2?|ttf|txt)$/i;

export async function proxy(req: NextRequest) {
  if (!process.env.HM_WEB_AUTH_TOKEN) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  if (STATIC_ASSET.test(pathname)) return NextResponse.next();

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (
    (await isValidSessionCookie(sessionCookie)) ||
    isValidBearer(req.headers.get("authorization"))
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
