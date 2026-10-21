import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(aiStatus());
}
