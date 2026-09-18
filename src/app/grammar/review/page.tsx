"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import {
  previewSession,
  SESSION_LIMITS,
  buildSessionQueue,
  type QueueConfig,
  type SessionLimit,
  type SessionSrsFields,
} from "@/lib/review-session";
import type { LearningState, Rating } from "@/lib/srs";
import { parseStoredExamples, type GrammarExample } from "@/lib/validation";

type GrammarCard = SessionSrsFields & {
  title: string;
  meaning: string;
  explanation: string;
  structure: string;
  examples: GrammarExample[];
  notes: string;
};

type Category = { id: string; name: string };

type PoolRow = Omit<GrammarCard, "nextReviewAt" | "learningState" | "examples"> & {
  nextReviewAt: string;
  learningState: string;
  examples: string | GrammarExample[];
};

export default function GrammarReviewPage() {
  const [pool, setPool] = useState<GrammarCard[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [queue, setQueue] = useState<GrammarCard[] | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<QueueConfig>({
    limit: 10,
    categoryId: "",
    includeNew: true,
  });

  const loadPool = useCallback(async (categoryId: string) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryId) params.set("categoryId", categoryId);
      const rows = await api<PoolRow[]>(`/api/grammar/review/pool?${params.toString()}`);
      setPool(
        rows.map((row) => ({
          ...row,
          learningState: row.learningState as LearningState,
          nextReviewAt: new Date(row.nextReviewAt),
          examples: Array.isArray(row.examples) ? row.examples : parseStoredExamples(row.examples),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review pool");
    }
  }, []);

  useEffect(() => {
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    void loadPool(config.categoryId);
  }, [config.categoryId, loadPool]);

  const preview = useMemo(
    () => (pool ? previewSession(pool, config, new Date()) : null),
    [pool, config],
  );

  const current = queue?.[0];

  function begin() {
    if (!pool) return;
    setQueue(buildSessionQueue(pool, config, new Date()));
    setStarted(true);
    setRevealed(false);
  }

  function reset() {
    setStarted(false);
    setQueue(null);
    setRevealed(false);
    void loadPool(config.categoryId);
  }

  const rate = useCallback(async (rating: Rating) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/grammar/review", {
        method: "POST",
        body: JSON.stringify({
          grammarId: current.id,
          rating,
        }),
      });
      setQueue((prev) => prev?.slice(1) ?? []);
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }, [busy, current]);

  useEffect(() => {
    if (!started) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.code === "Space") {
        event.preventDefault();
        if (current && !revealed) setRevealed(true);
        return;
      }
      if (!revealed || busy || !current) return;
      const rating = (
        {
          Digit1: "again",
          Digit2: "hard",
          Digit3: "good",
          Digit4: "easy",
          Numpad1: "again",
          Numpad2: "hard",
          Numpad3: "good",
          Numpad4: "easy",
        } as const
      )[event.code];
      if (rating) {
        event.preventDefault();
        void rate(rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, current, rate, revealed, started]);

  if (!started) {
    return (
      <main>
        <div className="header">
          <h1>Grammar review</h1>
        </div>
        <Status loading={!pool && !error} error={error}>
          <section className="card form" style={{ marginBottom: 12 }}>
            <label>
              Number of cards
              <select
                value={String(config.limit)}
                onChange={(e) =>
                  setConfig((currentConfig) => ({
                    ...currentConfig,
                    limit: (e.target.value === "all" ? "all" : Number(e.target.value)) as SessionLimit,
                  }))
                }
              >
                {SESSION_LIMITS.map((limit) => (
                  <option key={String(limit)} value={String(limit)}>
                    {limit === "all" ? "All due" : limit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={config.categoryId}
                onChange={(e) => setConfig((currentConfig) => ({ ...currentConfig, categoryId: e.target.value }))}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={config.includeNew}
                onChange={(e) => setConfig((currentConfig) => ({ ...currentConfig, includeNew: e.target.checked }))}
              />
              Include new cards
            </label>
          </section>
          {preview ? (
            <div className="grid" style={{ marginBottom: 12 }}>
              <Stat label="Due" value={preview.due} />
              <Stat label="Overdue" value={preview.overdue} />
              <Stat label="New" value={preview.new} />
              <Stat label="Estimated cards" value={preview.estimated} />
            </div>
          ) : null}
          <button type="button" disabled={!preview || preview.estimated === 0} onClick={begin}>
            Start session
          </button>
        </Status>
      </main>
    );
  }

  return (
    <main>
      <div className="header">
        <h1>Grammar review</h1>
        <span className="muted">{queue ? `${queue.length} left` : ""}</span>
      </div>
      <Status
        loading={false}
        error={error}
        empty={queue?.length === 0}
        emptyText="Session complete."
      >
        {current ? (
          <>
            <p className="muted">Recall the meaning and explanation</p>
            <button
              className="card flashcard secondary"
              type="button"
              onClick={() => setRevealed(true)}
            >
              <div>
                <p className="prompt">{current.title}</p>
                {current.structure ? <p className="muted">{current.structure}</p> : null}
                {revealed ? (
                  <>
                    <p className="answer">{current.meaning}</p>
                    {current.explanation ? <p>{current.explanation}</p> : null}
                    {current.examples.map((example, index) => (
                      <p className="muted" key={`${example.sentence}-${index}`}>
                        {example.sentence}
                        {example.translation ? ` — ${example.translation}` : ""}
                      </p>
                    ))}
                    {current.notes ? <p className="muted">{current.notes}</p> : null}
                  </>
                ) : (
                  <p className="muted">Tap or press Space to show answer</p>
                )}
              </div>
            </button>
            {revealed ? (
              <div className="ratings" style={{ marginTop: 12 }}>
                <button className="again" disabled={busy} onClick={() => rate("again")}>
                  Again <span className="kbd">1</span>
                </button>
                <button className="hard" disabled={busy} onClick={() => rate("hard")}>
                  Hard <span className="kbd">2</span>
                </button>
                <button className="good" disabled={busy} onClick={() => rate("good")}>
                  Good <span className="kbd">3</span>
                </button>
                <button className="easy" disabled={busy} onClick={() => rate("easy")}>
                  Easy <span className="kbd">4</span>
                </button>
              </div>
            ) : (
              <button type="button" style={{ marginTop: 12 }} onClick={() => setRevealed(true)}>
                Show Answer
              </button>
            )}
          </>
        ) : null}
      </Status>
      {queue?.length === 0 ? (
        <button type="button" style={{ marginTop: 12 }} onClick={reset}>New session</button>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <section className="card">
      <p className="muted">{label}</p>
      <p className="stat">{value}</p>
    </section>
  );
}
