import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, passwordConfigured, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Is the app protected, and is this device logged in? */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    protected: passwordConfigured(),
    loggedIn: await isAuthorized(request.cookies.get(SESSION_COOKIE)?.value),
  });
}

/** body { password } */
export async function POST(request: NextRequest) {
  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected) return NextResponse.json({ ok: true });
  const body = await readJson(request);
  const given = body.ok ? String((body.data as { password?: unknown })?.password ?? "") : "";
  if (!safeEqual(await sessionToken(given.trim()), await sessionToken(expected))) {
    await new Promise((resolve) => setTimeout(resolve, 800)); // slows down guessing
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

/** Log out on this device. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
