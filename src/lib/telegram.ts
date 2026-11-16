import { prisma } from "./db";
import type { PlanView } from "./plan-service";
import { DEFAULT_SETTINGS, SETTINGS_ID, settingsToRow } from "./settings";

/**
 * Daily reminders through a Telegram bot.
 *
 * Setup: create a bot with @BotFather, put its token in TELEGRAM_BOT_TOKEN, send the
 * bot any message, then press "Connect" in Settings (the app reads that message to
 * learn the chat id). Vercel Cron calls /api/cron/remind twice a day (see vercel.json).
 */

const API = "https://api.telegram.org";

export function telegramConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim());
}

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  let response: Response;
  try {
    response = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Could not reach Telegram.");
  }
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !data.ok) {
    throw new Error(response.status === 401 ? "Telegram rejected the bot token." : `Telegram: ${data.description ?? response.status}`);
  }
  return data.result as T;
}

export async function sendTelegram(chatId: string, text: string) {
  await call("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

interface TgUpdate {
  message?: { chat?: { id?: number; type?: string }; date?: number };
}

/** Chat id of the most recent private message sent to the bot. */
export function latestChatId(updates: TgUpdate[]): string | null {
  const privateMessages = updates
    .map((u) => u.message)
    .filter((m): m is NonNullable<TgUpdate["message"]> => Boolean(m?.chat?.id) && m?.chat?.type === "private");
  if (!privateMessages.length) return null;
  privateMessages.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
  return String(privateMessages[0].chat!.id);
}

export async function telegramStatus() {
  const row = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID }, select: { telegramChatId: true, remindersOn: true } });
  let botName: string | null = null;
  if (telegramConfigured()) {
    try {
      botName = (await call<{ username?: string }>("getMe")).username ?? null;
    } catch {
      botName = null;
    }
  }
  return {
    configured: telegramConfigured(),
    botName,
    connected: Boolean(row?.telegramChatId),
    remindersOn: row?.remindersOn ?? true,
  };
}

async function saveTelegram(data: { telegramChatId?: string; remindersOn?: boolean }) {
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...settingsToRow(DEFAULT_SETTINGS), ...data },
    update: data,
  });
}

export async function connectTelegram() {
  const updates = await call<TgUpdate[]>("getUpdates", { limit: 100, allowed_updates: ["message"] });
  const chatId = latestChatId(updates);
  if (!chatId) throw new Error("No message found. Open your bot in Telegram, press Start (or send any message), then try again.");
  await saveTelegram({ telegramChatId: chatId, remindersOn: true });
  await sendTelegram(chatId, "✅ Подключено. Каждый день я буду напоминать про корейский.\n화이팅! 💪");
  return telegramStatus();
}

export async function disconnectTelegram() {
  await saveTelegram({ telegramChatId: "" });
  return telegramStatus();
}

export async function setReminders(on: boolean) {
  await saveTelegram({ remindersOn: on });
  return telegramStatus();
}

export function appUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.APP_URL?.trim() || env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || "";
  if (!raw) return "";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw}`;
}

export type ReminderKind = "morning" | "evening";

/** Text of the reminder, or null when there is nothing worth sending. */
export function reminderText(plan: Pick<PlanView, "streak" | "steps" | "complete" | "minutesLeft" | "weeklyDue">, kind: ReminderKind, url = ""): string | null {
  const open = plan.steps.filter((s) => !s.done && !s.optional);
  if (kind === "evening" && (plan.complete || plan.streak.todayDone)) return null;

  const lines: string[] = [];
  if (kind === "morning") {
    lines.push(plan.streak.current > 0 ? `🔥 Серия: ${plan.streak.current} дн. Не прерывай.` : "🌱 Начни серию сегодня.");
    if (plan.complete) lines.push("На сегодня всё уже сделано. 👏");
  } else {
    lines.push(
      plan.streak.current > 0
        ? `⚠️ Серия ${plan.streak.current} дн. сгорит в полночь. Нужно хотя бы 5 карточек.`
        : "⏰ Сегодня корейского ещё не было. Хватит и 5 минут.",
    );
  }
  const names: Record<string, string> = {
    weekly: "недельный тест",
    review: "повторение",
    new: "новые слова",
    reading: "текст дня",
  };
  for (const step of open) {
    lines.push(`• ${names[step.key] ?? step.title}${step.count ? `: ${step.count}` : ""}`);
  }
  if (open.length) lines.push(`Примерно ${Math.max(3, plan.minutesLeft)} мин.`);
  if (url) lines.push(url);
  return lines.join("\n");
}

/** Called by the cron route. Returns what happened so the route can report it. */
export async function sendReminder(kind: ReminderKind, plan: PlanView) {
  if (!telegramConfigured()) return { sent: false, reason: "no bot token" };
  const row = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID }, select: { telegramChatId: true, remindersOn: true } });
  if (!row?.telegramChatId) return { sent: false, reason: "not connected" };
  if (!row.remindersOn) return { sent: false, reason: "reminders are off" };
  const text = reminderText(plan, kind, appUrl());
  if (!text) return { sent: false, reason: "nothing to remind" };
  await sendTelegram(row.telegramChatId, text);
  return { sent: true, reason: "" };
}
