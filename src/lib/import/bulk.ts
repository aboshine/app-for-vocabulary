import { prisma } from "../db";
import { parseImportText, type RawImportRow } from "./parse";
import { duplicateKey, planImport, srsInitFields, summarizePlan, validateImportRows, type DuplicateMode } from "./plan";

export async function previewImport(text: string) {
  const parsed = parseImportText(text);
  if ("error" in parsed) return parsed;
  const existingByKorean = await loadExisting(parsed.rows);
  const rows = validateImportRows(parsed.rows, existingByKorean);
  return { rows };
}

export async function executeImport(rows: RawImportRow[], mode: DuplicateMode, now = new Date()) {
  const existingByKorean = await loadExisting(rows);
  const preview = validateImportRows(rows, existingByKorean);
  const plan = planImport(preview, mode);

  await prisma.$transaction(async (tx) => {
    const categoryNames = [
      ...new Set(
        [...plan.inserts, ...plan.updates]
          .map((row) => row.category)
          .filter(Boolean),
      ),
    ];
    const categoryIds = new Map<string, string>();
    if (categoryNames.length > 0) {
      const existing = await tx.category.findMany({
        where: { name: { in: categoryNames } },
      });
      for (const category of existing) categoryIds.set(category.name, category.id);
      for (const name of categoryNames) {
        if (categoryIds.has(name)) continue;
        const created = await tx.category.create({ data: { name } });
        categoryIds.set(name, created.id);
      }
    }

    if (plan.inserts.length > 0) {
      await tx.vocabulary.createMany({
        data: plan.inserts.map((row) => ({
          korean: row.korean,
          meaning: row.meaning,
          exampleSentence: row.exampleSentence,
          exampleTranslation: row.exampleTranslation,
          notes: row.notes,
          tags: row.tags,
          categoryId: row.category ? categoryIds.get(row.category) ?? null : null,
          ...srsInitFields(now),
        })),
      });
    }

    for (const row of plan.updates) {
      await tx.vocabulary.update({
        where: { id: row.existingId as string },
        data: {
          korean: row.korean,
          meaning: row.meaning,
          exampleSentence: row.exampleSentence,
          exampleTranslation: row.exampleTranslation,
          notes: row.notes,
          tags: row.tags,
          categoryId: row.category ? categoryIds.get(row.category) ?? null : null,
        },
      });
    }
  });

  return { ...summarizePlan(plan), rows: preview };
}

async function loadExisting(rows: RawImportRow[]) {
  const koreans = [...new Set(rows.map((row) => duplicateKey(row.korean)).filter(Boolean))];
  const existingByKorean = new Map<string, string>();
  if (koreans.length === 0) return existingByKorean;
  const existing = await prisma.vocabulary.findMany({
    where: { korean: { in: koreans } },
    select: { id: true, korean: true },
  });
  for (const word of existing) existingByKorean.set(duplicateKey(word.korean), word.id);
  return existingByKorean;
}
