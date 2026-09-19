import { NextRequest, NextResponse } from "next/server";
import { executeImport } from "@/lib/import/bulk";
import type { DuplicateMode } from "@/lib/import/plan";
import { parseImportText } from "@/lib/import/parse";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ROWS = 2000;

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const data = body.data as { text?: unknown; duplicateMode?: unknown };
  const text = typeof data.text === "string" ? data.text : "";
  const duplicateMode = data.duplicateMode === "update" ? "update" : data.duplicateMode === "skip" ? "skip" : null;
  if (!duplicateMode) {
    return NextResponse.json({ error: "Choose skip or update for duplicates." }, { status: 400 });
  }
  const parsed = parseImportText(text);
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 });
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Import is limited to ${MAX_ROWS} rows.` }, { status: 400 });
  }
  try {
    const result = await executeImport(parsed.rows, duplicateMode as DuplicateMode);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}
