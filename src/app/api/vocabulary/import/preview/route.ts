import { NextRequest, NextResponse } from "next/server";
import { previewImport } from "@/lib/import/bulk";
import { readJson } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const text = typeof (body.data as { text?: unknown }).text === "string"
    ? (body.data as { text: string }).text
    : "";
  const result = await previewImport(text);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
