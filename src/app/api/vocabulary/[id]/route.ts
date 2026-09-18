import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidVocabId } from "@/lib/vocab-detail";
import { parseVocabInput, readJson } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid vocabulary id." }, { status: 400 });
  }
  const word = await prisma.vocabulary.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!word) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(word);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid vocabulary id." }, { status: 400 });
  }
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const parsed = parseVocabInput(body.data);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }
  if (parsed.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 400 });
  }
  try {
    const word = await prisma.vocabulary.update({
      where: { id },
      data: parsed,
      include: { category: true },
    });
    return NextResponse.json(word);
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
    return NextResponse.json({ error: "Invalid vocabulary id." }, { status: 400 });
  }
  try {
    await prisma.vocabulary.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
