import { prisma } from "./db";
import { startOfLocalDay } from "./day";
import {
  DEFAULT_SETTINGS,
  SETTINGS_ID,
  settingsFromRow,
  settingsToRow,
  type LearningSettings,
} from "./settings";

/** Words whose very first review happened today (uses the createdAt / vocabularyId indexes, no full scan). */
export async function countNewIntroducedToday(now = new Date()) {
  const dayStart = startOfLocalDay(now);
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT DISTINCT "vocabularyId" FROM "Review" WHERE "createdAt" >= ${dayStart}
    ) today
    WHERE NOT EXISTS (
      SELECT 1 FROM "Review" r WHERE r."vocabularyId" = today."vocabularyId" AND r."createdAt" < ${dayStart}
    )`;
  return rows[0]?.n ?? 0;
}

export async function getSettings(): Promise<LearningSettings> {
  const existing = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return settingsFromRow(existing);
  const created = await prisma.appSettings.create({
    data: { id: SETTINGS_ID, ...settingsToRow(DEFAULT_SETTINGS) },
  });
  return settingsFromRow(created);
}

export async function saveSettings(settings: LearningSettings): Promise<LearningSettings> {
  const data = settingsToRow(settings);
  const saved = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
  return settingsFromRow(saved);
}
