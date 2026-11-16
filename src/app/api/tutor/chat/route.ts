import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { cleanChat } from "@/lib/ai/tutor-prompts";
import { chat } from "@/lib/tutor-service";
import { readJson } from "@/lib/validation";

export const maxDuration = 60;

/** Ask the teacher: body { messages: [{ role: "user" | "teacher", content }] } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const messages = cleanChat(body.ok ? (body.data as { messages?: unknown })?.messages : null);
  try {
    return NextResponse.json({ reply: await chat(messages) });
  } catch (error) {
    return errorResponse(error);
  }
}
