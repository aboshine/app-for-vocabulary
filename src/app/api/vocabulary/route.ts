import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listVocabulary } from "@/lib/vocab-service";
import { parseVocabInput, readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const words = await listVocabulary({
    q: searchParams.get("q") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    state: searchParams.get("state") ?? undefined,
  });
  return NextResponse.json(words);
}

export async function POST(request: NextRequest) {
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
  const word = await prisma.vocabulary.create({
    data: parsed,
    include: { category: true },
  });
  return NextResponse.json(word, { status: 201 });
}
