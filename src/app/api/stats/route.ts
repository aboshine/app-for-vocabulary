import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/vocab-service";

export async function GET() {
  const stats = await getDashboardData();
  return NextResponse.json(stats);
}
