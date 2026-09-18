export type Rating = "again" | "hard" | "good" | "easy";
export type LearningState = "new" | "learning" | "learned";
export type ReviewDirection =
  | "ko-meaning"
  | "meaning-ko"
  | "sentence-meaning"
  | "sentence-completion"
  | "typing";

export const LEARNING_STATES: LearningState[] = ["new", "learning", "learned"];
export const RATINGS: Rating[] = ["again", "hard", "good", "easy"];
export const DIRECTIONS: ReviewDirection[] = [
  "ko-meaning",
  "meaning-ko",
  "sentence-meaning",
  "sentence-completion",
  "typing",
];

export interface SrsInput {
  intervalMinutes: number;
  learningState: LearningState;
}

export interface SrsResult {
  intervalMinutes: number;
  nextReviewAt: Date;
  learningState: LearningState;
}

export const MINUTE = 1;
export const HOUR = 60;
export const DAY = 24 * 60;

const INTERVALS = {
  again: 1 * MINUTE,
  hard: 10 * MINUTE,
  goodFirst: 1 * DAY,
  easyFirst: 4 * DAY,
} as const;

/** Replaceable SM-lite scheduler. Intervals are in minutes. */
export function scheduleReview(
  card: SrsInput,
  rating: Rating,
  now: Date = new Date(),
): SrsResult {
  const previous = Math.max(0, card.intervalMinutes);
  let intervalMinutes: number;
  let learningState: LearningState;

  switch (rating) {
    case "again":
      intervalMinutes = INTERVALS.again;
      learningState = "learning";
      break;
    case "hard":
      intervalMinutes =
        previous <= INTERVALS.hard ? INTERVALS.hard : Math.round(previous * 1.2);
      learningState = "learning";
      break;
    case "good":
      intervalMinutes = previous < DAY ? INTERVALS.goodFirst : Math.round(previous * 2.5);
      learningState = intervalMinutes >= 7 * DAY ? "learned" : "learning";
      break;
    case "easy":
      intervalMinutes = previous < DAY ? INTERVALS.easyFirst : Math.round(previous * 4);
      learningState = "learned";
      break;
  }

  return {
    intervalMinutes,
    nextReviewAt: new Date(now.getTime() + intervalMinutes * 60_000),
    learningState,
  };
}

export function isDue(nextReviewAt: Date, now: Date = new Date()): boolean {
  return nextReviewAt.getTime() <= now.getTime();
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
