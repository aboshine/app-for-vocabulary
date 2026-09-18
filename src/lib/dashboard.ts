export const MIN_REVIEWS_FOR_ACCURACY = 5;
export const MIN_REVIEWS_FOR_DIFFICULT = 2;

export function isSuccessfulRating(rating: string): boolean {
  return rating === "good" || rating === "easy";
}

export function accuracyFromRatings(ratings: string[], min = MIN_REVIEWS_FOR_ACCURACY): number | null {
  if (ratings.length < min) return null;
  const hits = ratings.filter(isSuccessfulRating).length;
  return hits / ratings.length;
}

export function accuracyFromCounts(success: number, total: number, min = MIN_REVIEWS_FOR_ACCURACY): number | null {
  if (total < min) return null;
  return success / total;
}

export interface WordReviewStats {
  id: string;
  korean: string;
  meaning: string;
  success: number;
  total: number;
}

export function rankDifficultWords(words: WordReviewStats[], limit = 10): WordReviewStats[] {
  return words
    .filter((word) => word.total >= MIN_REVIEWS_FOR_DIFFICULT)
    .sort((a, b) => a.success / a.total - b.success / b.total || b.total - a.total || a.korean.localeCompare(b.korean))
    .slice(0, limit);
}

export function remainingToday(recommended: number, reviewedToday: number): number {
  return Math.max(0, recommended - reviewedToday);
}

export interface CategoryProgress {
  id: string | null;
  name: string;
  total: number;
  learned: number;
}

export function assembleCategoryProgress(
  groups: Array<{ categoryId: string | null; learningState: string; count: number }>,
  names: Map<string, string>,
): CategoryProgress[] {
  const byId = new Map<string | null, CategoryProgress>();
  for (const group of groups) {
    const current = byId.get(group.categoryId) ?? {
      id: group.categoryId,
      name: group.categoryId ? names.get(group.categoryId) ?? "Unknown" : "Uncategorized",
      total: 0,
      learned: 0,
    };
    current.total += group.count;
    if (group.learningState === "learned") current.learned += group.count;
    byId.set(group.categoryId, current);
  }
  return [...byId.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
