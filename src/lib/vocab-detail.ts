import { DAY } from "./srs";

export type VocabStatusLabel = "New" | "Learning" | "Review" | "Learned";

export function isValidVocabId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

export function vocabStatusLabel(state: string, intervalMinutes: number): VocabStatusLabel {
  if (state === "new") return "New";
  if (state === "learned") return "Learned";
  if (state === "learning" && intervalMinutes >= DAY) return "Review";
  if (state === "learning") return "Learning";
  return "Learning";
}

export interface ReviewCountInput {
  reviewCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
}

export interface WordDetailStats {
  totalReviews: number;
  correct: number;
  incorrect: number;
  successRate: number | null;
}

export function wordDetailStats(counts: ReviewCountInput): WordDetailStats {
  const correct = Math.max(0, counts.goodCount) + Math.max(0, counts.easyCount);
  const incorrect = Math.max(0, counts.againCount) + Math.max(0, counts.hardCount);
  const totalReviews = Math.max(counts.reviewCount, correct + incorrect);
  return {
    totalReviews,
    correct,
    incorrect,
    successRate: totalReviews > 0 ? correct / totalReviews : null,
  };
}

export function formatInterval(minutes: number): string {
  if (minutes < 1) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < DAY) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours} hr`;
  }
  const days = Math.round((minutes / DAY) * 10) / 10;
  return `${days} day${days === 1 ? "" : "s"}`;
}
