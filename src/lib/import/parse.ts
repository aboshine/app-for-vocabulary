import { LIMITS } from "../validation";

export const IMPORT_FIELDS = [
  "korean",
  "meaning",
  "exampleSentence",
  "exampleTranslation",
  "category",
  "tags",
  "notes",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export interface RawImportRow {
  rowNumber: number;
  korean: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  category: string;
  tags: string;
  notes: string;
}

const HEADER_MAP: Record<string, ImportField> = {
  korean: "korean",
  meaning: "meaning",
  examplesentence: "exampleSentence",
  exampletranslation: "exampleTranslation",
  category: "category",
  tags: "tags",
  notes: "notes",
};

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function mapHeader(header: string): ImportField | null {
  return HEADER_MAP[normalizeHeader(header)] ?? null;
}

export function detectDelimiter(text: string): "," | "\t" {
  const raw = text.replace(/^\uFEFF/, "");
  const nl = raw.search(/\r?\n/);
  const line = nl === -1 ? raw : raw.slice(0, nl);
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || (char === "\r" && next === "\n") || char === "\r") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (char === "\r" && next === "\n") i += 1;
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseImportText(text: string): { error: string } | { rows: RawImportRow[] } {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return { error: "No import data." };

  const delimiter = detectDelimiter(trimmed);
  const table = parseDelimited(trimmed, delimiter);
  if (table.length < 2) return { error: "Include a header row and at least one data row." };

  const headerCells = table[0].map((cell) => mapHeader(cell));
  if (!headerCells.includes("korean") || !headerCells.includes("meaning")) {
    return { error: "Header must include korean and meaning columns." };
  }

  const rows: RawImportRow[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const cells = table[i];
    const record: RawImportRow = {
      rowNumber: i + 1,
      korean: "",
      meaning: "",
      exampleSentence: "",
      exampleTranslation: "",
      category: "",
      tags: "",
      notes: "",
    };
    headerCells.forEach((field, index) => {
      if (!field) return;
      record[field] = cells[index] ?? "";
    });
    rows.push(normalizeRawRow(record));
  }
  return { rows };
}

export function normalizeRawRow(row: RawImportRow): RawImportRow {
  return {
    rowNumber: row.rowNumber,
    korean: clip(row.korean.normalize("NFC"), LIMITS.korean),
    meaning: clip(row.meaning.normalize("NFC"), LIMITS.meaning),
    exampleSentence: clip(row.exampleSentence, LIMITS.example),
    exampleTranslation: clip(row.exampleTranslation, LIMITS.example),
    category: clip(row.category, LIMITS.category),
    tags: clip(row.tags, LIMITS.tags),
    notes: clip(row.notes, LIMITS.notes),
  };
}
