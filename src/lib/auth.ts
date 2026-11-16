/**
 * Optional password gate. Set APP_PASSWORD in the environment and the whole app
 * (pages and API) asks for it once per device. Without APP_PASSWORD the app stays open.
 *
 * Runs in middleware (Edge runtime), so only Web Crypto is used here.
 */

export const SESSION_COOKIE = "kv_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function passwordConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.APP_PASSWORD?.trim());
}

/** The cookie value for a password. Knowing the cookie does not reveal the password. */
export async function sessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`korean-vocab-session-v1|${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare without leaking how many leading characters match. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Paths that must work without a session: the login itself, cron (has its own secret) and app-icon files. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    /^\/(icon|apple-icon)[\w-]*\.(png|svg)$/.test(pathname) ||
    /^\/icons\//.test(pathname)
  );
}

export async function isAuthorized(cookieValue: string | undefined, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const password = env.APP_PASSWORD?.trim();
  if (!password) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken(password));
}
