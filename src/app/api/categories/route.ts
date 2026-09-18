import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCategoryName, readJson } from "@/lib/validation";

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { words: true } } },
  });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const name = parseCategoryName(body.data);
  if (typeof name !== "string") return NextResponse.json(name, { status: 400 });
  try {
    const category = await prisma.category.create({ data: { name } });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Category already exists." }, { status: 409 });
  }
}
