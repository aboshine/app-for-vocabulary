import { NextResponse } from "next/server";
import { AiError } from "./client";

export function errorResponse(error: unknown) {
  if (error instanceof AiError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status: 400 });
}
