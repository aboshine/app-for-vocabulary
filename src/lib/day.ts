/**
 * Calendar-day helpers in the learner's time zone (APP_TIMEZONE, default Asia/Seoul).
 * The server runs in UTC on Vercel, so "today" must not be taken from the server clock.
 */

export function appTimeZone(): string {
  return process.env.APP_TIMEZONE || "Asia/Seoul";
}

/** YYYY-MM-DD of `date` in the given zone. */
export function dayKey(date: Date, timeZone = appTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the local calendar day of `date` started. */
export function startOfLocalDay(date: Date, timeZone = appTimeZone()): Date {
  const offset = offsetMs(date, timeZone);
  const local = new Date(date.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

export function endOfLocalDay(date: Date, timeZone = appTimeZone()): Date {
  return new Date(startOfLocalDay(date, timeZone).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Shift a YYYY-MM-DD key by whole days. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday for a YYYY-MM-DD key. */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Monday of the week that contains `key`. */
export function weekStart(key: string): string {
  return addDays(key, -weekdayIndex(key));
}
