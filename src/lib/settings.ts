import { prisma } from "./db";
import { parseLevel, type Level, type TranslationLang } from "./ai/prompts";

export interface AppSettings {
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

export const DEFAULT_SETTINGS: AppSettings = {
  level: 2,
  lang: "ru",
  currentTheme: "",
  targetsPerText: 8,
  packSize: 8,
};

export function parseSettings(rows: Array<{ key: string; value: string }>): AppSettings {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const int = (key: keyof AppSettings, min: number, max: number) => {
    const n = Number(map.get(key));
    return Number.isInteger(n) && n >= min && n <= max ? n : (DEFAULT_SETTINGS[key] as number);
  };
  return {
    level: parseLevel(map.get("level"), DEFAULT_SETTINGS.level),
    lang: map.get("lang") === "en" ? "en" : "ru",
    currentTheme: map.get("currentTheme") ?? "",
    targetsPerText: int("targetsPerText", 3, 12),
    packSize: int("packSize", 3, 20),
  };
}

export async function getSettings(): Promise<AppSettings> {
  return parseSettings(await prisma.setting.findMany());
}

export async function updateSettings(patch: Partial<Record<keyof AppSettings, unknown>>): Promise<AppSettings> {
  const current = await getSettings();
  const next = parseSettings(
    Object.entries({ ...current, ...patch }).map(([key, value]) => ({ key, value: String(value ?? "") })),
  );
  await prisma.$transaction(
    (Object.keys(next) as Array<keyof AppSettings>).map((key) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: String(next[key]) },
        update: { value: String(next[key]) },
      }),
    ),
  );
  return next;
}
