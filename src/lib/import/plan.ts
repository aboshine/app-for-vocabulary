import type { RawImportRow } from "./parse";

export type DuplicateMode = "skip" | "update";

export interface PreviewRow extends RawImportRow {
  errors: string[];
  fileDuplicate: boolean;
  dbDuplicate: boolean;
  existingId: string | null;
}

export interface ImportPlan {
  inserts: PreviewRow[];
  updates: PreviewRow[];
  skipped: PreviewRow[];
  failed: PreviewRow[];
}

export function duplicateKey(korean: string): string {
  return korean.trim().normalize("NFC");
}

export function validateImportRows(
  rows: RawImportRow[],
  existingByKorean: Map<string, string>,
): PreviewRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.korean) errors.push("korean is required");
    if (!row.meaning) errors.push("meaning is required");

    const key = duplicateKey(row.korean);
    let fileDuplicate = false;
    if (key) {
      if (seen.has(key)) fileDuplicate = true;
      else seen.set(key, row.rowNumber);
    }
    const existingId = key ? existingByKorean.get(key) ?? null : null;
    return {
      ...row,
      errors,
      fileDuplicate,
      dbDuplicate: Boolean(existingId),
      existingId,
    };
  });
}

export function planImport(rows: PreviewRow[], mode: DuplicateMode): ImportPlan {
  const inserts: PreviewRow[] = [];
  const updates: PreviewRow[] = [];
  const skipped: PreviewRow[] = [];
  const failed: PreviewRow[] = [];

  for (const row of rows) {
    if (row.errors.length > 0) {
      failed.push(row);
      continue;
    }
    if (row.fileDuplicate) {
      skipped.push(row);
      continue;
    }
    if (row.dbDuplicate) {
      if (mode === "update" && row.existingId) updates.push(row);
      else skipped.push(row);
      continue;
    }
    inserts.push(row);
  }

  return { inserts, updates, skipped, failed };
}

export function summarizePlan(plan: ImportPlan) {
  return {
    imported: plan.inserts.length,
    updated: plan.updates.length,
    skipped: plan.skipped.length,
    failed: plan.failed.length,
  };
}

export function srsInitFields(now: Date) {
  return {
    learningState: "new",
    intervalMinutes: 0,
    nextReviewAt: now,
    reviewCount: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
  };
}
