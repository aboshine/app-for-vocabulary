import { prisma } from "./db";
import { parseLevel, type Level, type TranslationLang } from "./ai/prompts";
import { DEFAULT_SETTINGS, SETTINGS_ID, settingsToRow } from "./settings";

/**
 * Settings for AI reading / word packs. Stored as extra columns on the existing
 * AppSettings row (id = SETTINGS_ID), next to the review settings from settings.ts.
 */
export interface AiSettings {
  /** TOPIK level used for texts, packs and card filling */
  level: Level;
  /** language of meanings / translations produced by AI */
  lang: TranslationLang;
  /** curriculum theme key the learner is focusing on ("" = none) */
  currentTheme: string;
  /** how many target words a daily text is built around */
  targetsPerText: number;
  /** words added per "next pack" click */
  packSize: number;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  level: 2,
  lang: "ru",
  currentTheme: "",
  targetsPerText: 8,
  packSize: 8,
};

export interface AiSettingsRow {
  aiLevel: number;
  aiLang: string;
  currentTheme: string;
  targetsPerText: number;
  packSize: number;
}

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Validate a full or partial input, falling back to `base` for anything missing or invalid. */
export function parseAiSettings(input: Partial<Record<keyof AiSettings, unknown>>, base = DEFAULT_AI_SETTINGS): AiSettings {
  return {
    level: input.level === undefined ? base.level : parseLevel(input.level, base.level),
    lang: input.lang === "en" || input.lang === "ru" ? input.lang : base.lang,
    currentTheme: typeof input.currentTheme === "string" ? input.currentTheme.trim().slice(0, 40) : base.currentTheme,
    targetsPerText: intIn(input.targetsPerText, 3, 12, base.targetsPerText),
    packSize: intIn(input.packSize, 3, 20, base.packSize),
  };
}

export function aiSettingsFromRow(row: AiSettingsRow): AiSettings {
  return parseAiSettings({
    level: row.aiLevel,
    lang: row.aiLang,
    currentTheme: row.currentTheme,
    targetsPerText: row.targetsPerText,
    packSize: row.packSize,
  });
}

export function aiSettingsToRow(settings: AiSettings): AiSettingsRow {
  return {
    aiLevel: settings.level,
    aiLang: settings.lang,
    currentTheme: settings.currentTheme,
    targetsPerText: settings.targetsPerText,
    packSize: settings.packSize,
  };
}

export async function getAiSettings(): Promise<AiSettings> {
  const row = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row ? aiSettingsFromRow(row) : { ...DEFAULT_AI_SETTINGS };
}

export async function updateAiSettings(patch: Partial<Record<keyof AiSettings, unknown>>): Promise<AiSettings> {
  const next = parseAiSettings(patch, await getAiSettings());
  const data = aiSettingsToRow(next);
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    // First write creates the row with the default review settings too.
    create: { id: SETTINGS_ID, ...settingsToRow(DEFAULT_SETTINGS), ...data },
    update: data,
  });
  return next;
}
