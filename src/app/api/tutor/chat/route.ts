import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { cleanChat } from "@/lib/ai/tutor-prompts";
import { chatStream } from "@/lib/tutor-service";
import { readJson } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Ask the teacher: body { messages: [{ role: "user" | "teacher", content }] }.
 * The answer is plain text sent piece by piece. Errors before the first piece come back
 * as JSON with an error status; an error in the middle ends the text with a marker line.
 */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const messages = cleanChat(body.ok ? (body.data as { messages?: unknown })?.messages : null);
  let pieces: AsyncGenerator<string>;
  let first: IteratorResult<string>;
  try {
    pieces = await chatStream(messages);
    first = await pieces.next(); // wait for the first piece so failures still get a proper status code
  } catch (error) {
    return errorResponse(error);
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const piece of pieces) controller.enqueue(encoder.encode(piece));
      } catch {
        controller.enqueue(encoder.encode("\n\n[The answer was cut off. Send your question again.]"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
