import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, isPublicPath, passwordConfigured, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  if (!passwordConfigured()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (await isAuthorized(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // everything except Next's own static files
  matcher: ["/((?!_next/static|_next/image).*)"],
};
