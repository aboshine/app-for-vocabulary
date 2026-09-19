import { MODE_FILTERS, MIXED_ROTATION, mixedRotation, type ModeFilter, type ReviewMode } from "./review-modes";
import { remainingNewCards, type SessionConfig, type SessionLimit } from "./review-session";

export const SETTINGS_ID = "local";
export const NEW_WORD_PRESETS = [5, 10, 20, 30] as const;
export const REVIEW_TARGET_PRESETS = [10, 20, 30] as const;
export const CUSTOM_LIMIT_MAX = 200;

export const MIXED_MODE_OPTIONS: Array<{ id: ReviewMode; label: string }> = [
  { id: "ko-meaning", label: "Korean → Meaning" },
  { id: "meaning-ko", label: "Meaning → Korean" },
  { id: "sentence-meaning", label: "Sentence meaning" },
  { id: "sentence-completion", label: "Sentence completion" },
  { id: "sentence-production", label: "Sentence Production" },
  { id: "typing", label: "Typing" },
];

export const MODE_FILTER_OPTIONS: Array<{ id: ModeFilter; label: string }> = [
  { id: "mixed", label: "Mixed" },
  { id: "ko-meaning", label: "Korean → Meaning" },
  { id: "meaning-ko", label: "Meaning → Korean" },
  { id: "sentence", label: "Sentence" },
  { id: "typing", label: "Typing" },
  { id: "sentence-production", label: "Sentence Production" },
];

export interface LearningSettings {
  dailyNewWordLimit: number;
  sessionLimit: SessionLimit;
  defaultMode: ModeFilter;
  mixedModes: ReviewMode[];
  includeNew: boolean;
  defaultCategoryId: string;
  dailyReviewTarget: number;
}

export const DEFAULT_SETTINGS: LearningSettings = {
  dailyNewWordLimit: 10,
  sessionLimit: 10,
  defaultMode: "mixed",
  mixedModes: [...MIXED_ROTATION],
  includeNew: true,
  defaultCategoryId: "",
  dailyReviewTarget: 20,
};

export interface StoredSettingsRow {
  dailyNewWordLimit: number;
  sessionLimit: string;
  defaultMode: string;
  mixedModes: string;
  includeNew: boolean;
  defaultCategoryId: string;
  dailyReviewTarget: number;
}

function clampLimit(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(CUSTOM_LIMIT_MAX, Math.max(1, Math.round(value)));
}

function parseSessionLimit(value: unknown): SessionLimit {
  if (value === "all") return "all";
  const numeric = typeof value === "number" ? value : Number(value);
  if (numeric === 10 || numeric === 20 || numeric === 30) return numeric;
  return DEFAULT_SETTINGS.sessionLimit;
}

function parseModeFilter(value: unknown): ModeFilter {
  return MODE_FILTERS.includes(value as ModeFilter)
    ? (value as ModeFilter)
    : DEFAULT_SETTINGS.defaultMode;
}

export function parseMixedModes(value: unknown): ReviewMode[] {
  let raw: unknown = value;
  if (typeof value === "string") {
    if (!value.trim()) return [...DEFAULT_SETTINGS.mixedModes];
    try {
      raw = JSON.parse(value);
    } catch {
      return [...DEFAULT_SETTINGS.mixedModes];
    }
  }
  if (!Array.isArray(raw)) return [...DEFAULT_SETTINGS.mixedModes];
  const allowed = new Set<ReviewMode>(MIXED_ROTATION);
  const selected = raw.filter((item): item is ReviewMode => allowed.has(item as ReviewMode));
  return mixedRotation(selected);
}

export function serializeMixedModes(modes: ReviewMode[]): string {
  return JSON.stringify(mixedRotation(modes));
}

export function settingsFromRow(row: StoredSettingsRow): LearningSettings {
  return {
    dailyNewWordLimit: clampLimit(row.dailyNewWordLimit, DEFAULT_SETTINGS.dailyNewWordLimit),
    sessionLimit: parseSessionLimit(row.sessionLimit),
    defaultMode: parseModeFilter(row.defaultMode),
    mixedModes: parseMixedModes(row.mixedModes),
    includeNew: Boolean(row.includeNew),
    defaultCategoryId: String(row.defaultCategoryId ?? ""),
    dailyReviewTarget: clampLimit(row.dailyReviewTarget, DEFAULT_SETTINGS.dailyReviewTarget),
  };
}

export function settingsToRow(settings: LearningSettings): Omit<StoredSettingsRow, never> {
  return {
    dailyNewWordLimit: settings.dailyNewWordLimit,
    sessionLimit: String(settings.sessionLimit),
    defaultMode: settings.defaultMode,
    mixedModes: serializeMixedModes(settings.mixedModes),
    includeNew: settings.includeNew,
    defaultCategoryId: settings.defaultCategoryId,
    dailyReviewTarget: settings.dailyReviewTarget,
  };
}

export function parseSettingsInput(body: unknown): LearningSettings | string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Invalid payload.";
  const data = body as Record<string, unknown>;
  const includeNew = data.includeNew;
  if (typeof includeNew !== "boolean") return "Include new cards must be on or off.";
  return {
    dailyNewWordLimit: clampLimit(Number(data.dailyNewWordLimit), DEFAULT_SETTINGS.dailyNewWordLimit),
    sessionLimit: parseSessionLimit(data.sessionLimit),
    defaultMode: parseModeFilter(data.defaultMode),
    mixedModes: parseMixedModes(data.mixedModes),
    includeNew,
    defaultCategoryId: String(data.defaultCategoryId ?? "").trim(),
    dailyReviewTarget: clampLimit(Number(data.dailyReviewTarget), DEFAULT_SETTINGS.dailyReviewTarget),
  };
}

export function persistSettings(
  current: LearningSettings,
  next: LearningSettings,
): LearningSettings {
  return { ...current, ...next };
}

export function sessionConfigFromSettings(
  settings: LearningSettings,
  introducedToday = 0,
): SessionConfig {
  return {
    limit: settings.sessionLimit,
    mode: settings.defaultMode,
    categoryId: settings.defaultCategoryId,
    includeNew: settings.includeNew,
    mixedModes: settings.mixedModes,
    newCardLimit: remainingNewCards(settings.dailyNewWordLimit, introducedToday),
  };
}
