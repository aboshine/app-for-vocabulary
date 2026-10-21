/** Pull the first JSON object/array out of a model answer (tolerates code fences and stray prose). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (start !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON found in the answer");
}

export function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a list`);
  return value;
}

export function str(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "";
}
