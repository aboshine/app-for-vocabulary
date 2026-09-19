import { prisma } from "./db";
import { startOfDay } from "./srs";
import {
  DEFAULT_SETTINGS,
  SETTINGS_ID,
  settingsFromRow,
  settingsToRow,
  type LearningSettings,
} from "./settings";

export async function countNewIntroducedToday(now = new Date()) {
  const dayStart = startOfDay(now);
  const groups = await prisma.review.groupBy({
    by: ["vocabularyId"],
    _min: { createdAt: true },
  });
  return groups.filter((group) => group._min.createdAt && group._min.createdAt >= dayStart).length;
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
