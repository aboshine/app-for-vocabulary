import { NextResponse } from "next/server";
import { listThemeProgress } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listThemeProgress());
}
