import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteGrammar, updateGrammar } from "@/lib/grammar-service";
import { isValidVocabId } from "@/lib/vocab-detail";
import { parseGrammarInput, readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid grammar id." }, { status: 400 });
  }
  const item = await prisma.grammar.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid grammar id." }, { status: 400 });
  }
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const parsed = parseGrammarInput(body.data);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }
  if (parsed.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 400 });
  }
  try {
    const item = await updateGrammar(id, parsed);
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid grammar id." }, { status: 400 });
  }
  try {
    await deleteGrammar(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
