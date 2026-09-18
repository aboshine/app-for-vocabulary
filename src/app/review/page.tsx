"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import {
  assignQueueModes,
  buildPrompt,
  isTypingAnswerCorrect,
  typingReviewPayload,
  type ModeFilter,
  type ReviewMode,
} from "@/lib/review-modes";
import {
  previewSession,
  SESSION_LIMITS,
  startSession,
  TODAY_SESSION,
  type SessionCard,
  type SessionConfig,
  type SessionLimit,
} from "@/lib/review-session";
import type { LearningState, Rating } from "@/lib/srs";

type QueuedWord = SessionCard & { mode: ReviewMode };
type Category = { id: string; name: string };

const FILTERS: Array<{ id: ModeFilter; label: string }> = [
  { id: "mixed", label: "Mixed" },
  { id: "ko-meaning", label: "Korean → Meaning" },
  { id: "meaning-ko", label: "Meaning → Korean" },
  { id: "sentence", label: "Sentence" },
  { id: "typing", label: "Typing" },
];

export default function ReviewPage() {
  const router = useRouter();
  const [pool, setPool] = useState<SessionCard[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [queue, setQueue] = useState<QueuedWord[] | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const typingInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<SessionConfig>({
    limit: 10,
    mode: "mixed",
    categoryId: "",
    includeNew: true,
  });

  const loadPool = useCallback(async (categoryId: string) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryId) params.set("categoryId", categoryId);
      const rows = await api<Array<Omit<SessionCard, "nextReviewAt" | "learningState"> & { nextReviewAt: string; learningState: string }>>(
        `/api/review/pool?${params.toString()}`,
      );
      setPool(
        rows.map((row) => ({
          ...row,
          learningState: row.learningState as LearningState,
          nextReviewAt: new Date(row.nextReviewAt),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review pool");
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("word")) return;
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("word")) return;
    void loadPool(config.categoryId);
  }, [config.categoryId, loadPool]);

  useEffect(() => {
    if (started) return;
    const params = new URLSearchParams(window.location.search);
    const wordId = params.get("word");
    if (wordId) {
      api<SessionCard & { nextReviewAt: string; learningState: string }>(`/api/vocabulary/${wordId}`)
        .then((row) => {
          const card: SessionCard = {
            ...row,
            learningState: row.learningState as LearningState,
            nextReviewAt: new Date(row.nextReviewAt),
            categoryId: row.categoryId ?? null,
          };
          setQueue(assignQueueModes([card], "mixed"));
          setStarted(true);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Word not found"));
      return;
    }
    if (!pool) return;
    if (params.get("today") !== "1") return;
    setConfig(TODAY_SESSION);
    setQueue(startSession(pool, TODAY_SESSION, new Date()));
    setStarted(true);
  }, [pool, started]);

  const preview = useMemo(
    () => (pool ? previewSession(pool, config, new Date()) : null),
    [pool, config],
  );

  const current = queue?.[0];
  const content = useMemo(
    () => (current ? buildPrompt(current, current.mode) : null),
    [current],
  );
  const isTyping = current?.mode === "typing";
  const typingCorrect = current ? isTypingAnswerCorrect(typed, current.korean) : false;

  useEffect(() => {
    if (!started || !isTyping || revealed) return;
    typingInputRef.current?.focus();
  }, [isTyping, revealed, started, current?.id]);

  function begin() {
    if (!pool) return;
    setQueue(startSession(pool, config, new Date()));
    setStarted(true);
    setRevealed(false);
    setTyped("");
    setSubmitted(false);
  }

  function reset() {
    const wordId = new URLSearchParams(window.location.search).get("word");
    if (wordId) {
      router.push(`/vocabulary/${wordId}`);
      return;
    }
    setStarted(false);
    setQueue(null);
    setRevealed(false);
    setTyped("");
    setSubmitted(false);
    void loadPool(config.categoryId);
  }

  function submitTyping(event?: FormEvent) {
    event?.preventDefault();
    if (!current || revealed) return;
    setSubmitted(true);
    setRevealed(true);
  }

  const rate = useCallback(async (rating: Rating) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/review", {
        method: "POST",
        body: JSON.stringify(
          current.mode === "typing"
            ? typingReviewPayload(current.id, rating)
            : {
                vocabularyId: current.id,
                rating,
                direction: current.mode,
              },
        ),
      });
      setQueue((prev) => prev?.slice(1) ?? []);
      setRevealed(false);
      setTyped("");
      setSubmitted(false);
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
        if (current?.mode === "typing") return;
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
          <h1>Review</h1>
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
            <div>
              <p>Review mode</p>
              <div className="mode-grid">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    className={config.mode === item.id ? "" : "secondary"}
                    type="button"
                    onClick={() => setConfig((currentConfig) => ({ ...currentConfig, mode: item.id }))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
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
        <h1>Review</h1>
        <span className="muted">{queue ? `${queue.length} left` : ""}</span>
      </div>
      <Status
        loading={false}
        error={error}
        empty={queue?.length === 0}
        emptyText="Session complete."
      >
        {current && content ? (
          isTyping ? (
            <>
              <p className="muted">{content.hint}</p>
              <section className="card flashcard" style={{ cursor: "default" }}>
                <div>
                  <p className="prompt">{content.prompt}</p>
                  {revealed ? (
                    <>
                      <p className="muted">Your answer</p>
                      <p className="answer">{typed.trim() ? typed : "—"}</p>
                      <p className="muted">Correct Korean</p>
                      <p className="answer">{content.answer}</p>
                      {submitted ? (
                        <p>
                          <span className="badge">{typingCorrect ? "Correct" : "Incorrect"}</span>
                        </p>
                      ) : null}
                      {content.extras.map((line) => (
                        <p className="muted" key={line}>{line}</p>
                      ))}
                    </>
                  ) : (
                    <p className="muted">Type the Korean word, then Enter</p>
                  )}
                </div>
              </section>
              {!revealed ? (
                <form className="form" style={{ marginTop: 12 }} onSubmit={submitTyping}>
                  <label>
                    Korean
                    <input
                      ref={typingInputRef}
                      className="typing-input"
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      enterKeyHint="done"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                    />
                  </label>
                  <div className="row">
                    <button type="submit">Submit</button>
                    <button className="secondary" type="button" onClick={() => setRevealed(true)}>
                      Show answer
                    </button>
                  </div>
                </form>
              ) : (
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
              )}
            </>
          ) : (
            <>
              <p className="muted">{content.hint}</p>
              <button
                className="card flashcard secondary"
                type="button"
                onClick={() => setRevealed(true)}
              >
                <div>
                  <p className="prompt">{content.prompt}</p>
                  {revealed ? (
                    <>
                      <p className="answer">{content.answer}</p>
                      {content.extras.map((line) => (
                        <p className="muted" key={line}>{line}</p>
                      ))}
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
              ) : null}
            </>
          )
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
