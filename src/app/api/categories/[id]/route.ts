import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCategoryName, readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const name = parseCategoryName(body.data);
  if (typeof name !== "string") return NextResponse.json(name, { status: 400 });
  try {
    const category = await prisma.category.update({ where: { id }, data: { name } });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Not found or duplicate name." }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
