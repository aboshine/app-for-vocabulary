import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createGrammar, listGrammar } from "@/lib/grammar-service";
import { parseGrammarInput, readJson } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const items = await listGrammar({
    q: searchParams.get("q") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    state: searchParams.get("state") ?? undefined,
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
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
  const item = await createGrammar(parsed);
  return NextResponse.json(item, { status: 201 });
}
