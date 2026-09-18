import { describe, expect, it } from "vitest";
import { DAY, scheduleReview } from "../lib/srs";

describe("scheduleReview", () => {
  const now = new Date("2026-09-19T00:00:00.000Z");
  const fresh = { intervalMinutes: 0, learningState: "new" as const };

  it("sets a 1-minute interval for Again", () => {
    const result = scheduleReview(fresh, "again", now);
    expect(result.intervalMinutes).toBe(1);
    expect(result.learningState).toBe("learning");
    expect(result.nextReviewAt.toISOString()).toBe("2026-09-19T00:01:00.000Z");
  });

  it("sets a 10-minute interval for Hard on a new card", () => {
    const result = scheduleReview(fresh, "hard", now);
    expect(result.intervalMinutes).toBe(10);
    expect(result.learningState).toBe("learning");
  });

  it("sets a 1-day interval for Good on a new card", () => {
    const result = scheduleReview(fresh, "good", now);
    expect(result.intervalMinutes).toBe(DAY);
    expect(result.learningState).toBe("learning");
  });

  it("sets a 4-day interval and learned state for Easy on a new card", () => {
    const result = scheduleReview(fresh, "easy", now);
    expect(result.intervalMinutes).toBe(4 * DAY);
    expect(result.learningState).toBe("learned");
  });

  it("lengthens Good reviews from an existing interval", () => {
    const result = scheduleReview(
      { intervalMinutes: 2 * DAY, learningState: "learning" },
      "good",
      now,
    );
    expect(result.intervalMinutes).toBe(5 * DAY);
    expect(result.learningState).toBe("learning");
  });

  it("marks long Good intervals as learned", () => {
    const result = scheduleReview(
      { intervalMinutes: 4 * DAY, learningState: "learning" },
      "good",
      now,
    );
    expect(result.intervalMinutes).toBe(10 * DAY);
    expect(result.learningState).toBe("learned");
  });

  it("grows Easy intervals the most", () => {
    const result = scheduleReview(
      { intervalMinutes: DAY, learningState: "learning" },
      "easy",
      now,
    );
    expect(result.intervalMinutes).toBe(4 * DAY);
    expect(result.learningState).toBe("learned");
  });

  it("keeps Hard shorter than Good", () => {
    const card = { intervalMinutes: 2 * DAY, learningState: "learning" as const };
    const hard = scheduleReview(card, "hard", now);
    const good = scheduleReview(card, "good", now);
    expect(hard.intervalMinutes).toBeLessThan(good.intervalMinutes);
    expect(hard.learningState).toBe("learning");
  });
});
