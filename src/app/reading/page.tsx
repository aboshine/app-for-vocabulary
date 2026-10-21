"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import type { ReadingToken } from "@/lib/ai/prompts";
import type { ReadingView } from "@/lib/reading";
import { speakKorean, stopSpeaking } from "@/lib/speech";

type HistoryItem = { id: string; day: string; title: string; level: string; completedAt: string | null };
type AiStatus = { configured: boolean; provider: string | null; smartModel: string | null };

interface Selected {
  sentence: number;
  token: number;
}

export default function ReadingPage() {
  const [view, setView] = useState<ReadingView | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const id = new URLSearchParams(window.location.search).get("id");
      const [data, status] = await Promise.all([
        api<{ today: ReadingView | null; history: HistoryItem[] }>("/api/reading"),
        api<AiStatus>("/api/ai/status"),
      ]);
      setHistory(data.history);
      setAi(status);
      setView(id ? await api<ReadingView>(`/api/reading/${id}`) : data.today);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => stopSpeaking();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const created = await api<ReadingView>("/api/reading", { method: "POST" });
      window.history.replaceState(null, "", "/reading");
      setView(created);
      setHistory((items) => [
        { id: created.id, day: created.day, title: created.payload.title, level: created.level, completedAt: null },
        ...items,
      ]);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Reading</h1>
        {view ? <span className="badge">TOPIK {view.level}급 · {view.day}</span> : null}
      </div>
      <Status loading={loading} error={null}>
        {error ? <p className="error card" style={{ marginBottom: 12 }}>{error}</p> : null}
        {ai && !ai.configured ? (
          <section className="card" style={{ marginBottom: 12 }}>
            <p><strong>AI is not connected yet.</strong></p>
            <p className="muted">Add a free Gemini key to generate texts. See <Link href="/settings" className="link">Settings</Link>.</p>
          </section>
        ) : null}
        {view ? (
          <Reader key={view.id} view={view} onChange={setView} />
        ) : (
          <section className="card">
            <p><strong>Today&apos;s text</strong></p>
            <p className="muted">
              A short story at your level, built around the words you are learning now and the ones due for
              review. Tap any word to see its meaning.
            </p>
            <button type="button" className="wide" disabled={generating || (ai !== null && !ai.configured)} onClick={generate}>
              {generating ? "Writing your text… (10–30 s)" : "Generate today's text"}
            </button>
          </section>
        )}
        {view ? (
          <button type="button" className="secondary wide" style={{ marginTop: 16 }} disabled={generating} onClick={generate}>
            {generating ? "Writing a new text… (10–30 s)" : "Another text"}
          </button>
        ) : null}
        {history.length > 1 || (history.length === 1 && history[0].id !== view?.id) ? (
          <>
            <h2 className="section-title" style={{ marginTop: 20 }}>Earlier texts</h2>
            <div className="compact card">
              {history.map((item) => (
                <a
                  className="compact-row"
                  key={item.id}
                  href={`/reading?id=${item.id}`}
                  aria-current={item.id === view?.id ? "page" : undefined}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>{item.day}</span>
                  </span>
                  <span className="badge">{item.completedAt ? "read ✓" : "not read"}</span>
                </a>
              ))}
            </div>
          </>
        ) : null}
      </Status>
    </main>
  );
}

function Reader({ view, onChange }: { view: ReadingView; onChange: (view: ReadingView) => void }) {
  const { payload, links, deck } = view;
  const [selected, setSelected] = useState<Selected | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openTr, setOpenTr] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [ratings, setRatings] = useState<Record<string, "again" | "good">>({});
  const [added, setAdded] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetIds = useMemo(() => new Set(view.targets.map((t) => t.id)), [view.targets]);

  const fullText = payload.sentences.map((s) => s.ko).join(" ");

  function toggleTr(index: number) {
    setOpenTr((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function addToDeck(token: ReadingToken, sentenceIndex: number) {
    const sentence = payload.sentences[sentenceIndex];
    const korean = token.lemma || token.t.replace(/[.,!?"'…]+$/u, "");
    setBusy(true);
    setError(null);
    try {
      const word = await api<{ id: string }>("/api/vocabulary", {
        method: "POST",
        body: JSON.stringify({
          korean,
          meaning: token.gloss || "?",
          exampleSentence: sentence.ko,
          exampleTranslation: sentence.tr,
          tags: "reading",
          notes: "",
          categoryId: "",
        }),
      });
      setAdded((current) => ({ ...current, [korean]: word.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reading/${view.id}`, {
        method: "POST",
        body: JSON.stringify({
          results: view.targets.map((t) => ({ vocabularyId: t.id, rating: ratings[t.id] ?? "good" })),
        }),
      });
      onChange({ ...view, completedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const sel = selected ? payload.sentences[selected.sentence]?.tokens[selected.token] : null;
  const selWordId = selected ? links[selected.sentence]?.[selected.token] : null;
  const selDeck = selWordId ? deck[selWordId] : null;
  const selLemma = sel ? sel.lemma || sel.t.replace(/[.,!?"'…]+$/u, "") : "";

  return (
    <>
      <section className="card reader">
        <h2 className="reader-title">{payload.title}</h2>
        {payload.titleTr ? <p className="muted" style={{ marginTop: 0 }}>{payload.titleTr}</p> : null}
        <div className="row" style={{ marginBottom: 12 }}>
          <button type="button" className="secondary small" onClick={() => speakKorean(fullText)}>▶ Listen</button>
          <button type="button" className="secondary small" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Hide translation" : "Show translation"}
          </button>
        </div>
        {payload.sentences.map((sentence, si) => (
          <div className="sentence" key={si}>
            <p className="ko">
              {sentence.tokens.map((token, ti) => {
                const wordId = links[si]?.[ti];
                const cls = ["tok"];
                if (wordId && targetIds.has(wordId)) cls.push("target");
                else if (wordId) cls.push("known");
                if (selected?.sentence === si && selected.token === ti) cls.push("active");
                const last = ti === sentence.tokens.length - 1;
                return (
                  <span key={ti} className={last ? "nowrap" : undefined}>
                    <button type="button" className={cls.join(" ")} onClick={() => setSelected({ sentence: si, token: ti })}>
                      {token.t}
                    </button>
                    {last ? (
                      <>
                        <button type="button" className="icon" aria-label="Play sentence" onClick={() => speakKorean(sentence.ko)}>▶</button>
                        <button type="button" className="icon" aria-label="Translate sentence" onClick={() => toggleTr(si)}>文</button>
                      </>
                    ) : " "}
                  </span>
                );
              })}
            </p>
            {showAll || openTr.has(si) ? <p className="tr">{sentence.tr}</p> : null}
          </div>
        ))}
        <p className="muted legend">
          <span className="tok target">target</span> words you are learning · <span className="tok known">dotted</span> already in your deck
        </p>
      </section>

      {sel && selected ? (
        <div className="sheet" role="dialog" aria-label="Word">
          <div className="sheet-inner">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <p className="sheet-word">{selLemma}</p>
                {sel.lemma && sel.lemma !== sel.t ? <p className="muted" style={{ margin: 0 }}>in text: {sel.t}</p> : null}
              </div>
              <button type="button" className="secondary small" onClick={() => speakKorean(selLemma)}>▶</button>
            </div>
            <p className="sheet-gloss">{selDeck?.meaning || sel.gloss || "—"}</p>
            {selDeck ? (
              <p className="muted">In your deck · {selDeck.learningState}{selWordId && targetIds.has(selWordId) ? " · today's target" : ""}</p>
            ) : added[selLemma] ? (
              <p className="muted">Added to your deck ✓</p>
            ) : selLemma ? (
              <button type="button" className="wide" disabled={busy} onClick={() => addToDeck(sel, selected.sentence)}>
                + Add to deck (with this sentence)
              </button>
            ) : null}
            <button type="button" className="secondary wide" style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      ) : null}

      {payload.grammar.length ? (
        <>
          <h2 className="section-title" style={{ marginTop: 16 }}>Grammar in this text</h2>
          <div className="list">
            {payload.grammar.map((g, i) => (
              <section className="card" key={i}>
                <p style={{ margin: 0 }}><strong>{g.pattern}</strong></p>
                <p style={{ margin: "4px 0" }}>{g.explain}</p>
                {g.example ? <p className="muted ko-small" style={{ margin: 0 }}>{g.example}</p> : null}
              </section>
            ))}
          </div>
        </>
      ) : null}

      {payload.questions.length ? (
        <>
          <h2 className="section-title" style={{ marginTop: 16 }}>Check yourself</h2>
          <div className="list">
            {payload.questions.map((q, qi) => {
              const picked = answers[qi];
              return (
                <section className="card" key={qi}>
                  <p style={{ marginTop: 0 }}><strong>{qi + 1}. {q.q}</strong></p>
                  <div className="options">
                    {q.options.map((option, oi) => {
                      const state = picked === undefined ? "" : oi === q.answer ? "right" : oi === picked ? "wrong" : "";
                      return (
                        <button
                          type="button"
                          key={oi}
                          className={`secondary option ${state}`}
                          disabled={picked !== undefined}
                          onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {picked !== undefined ? (
                    <p className={picked === q.answer ? "good-text" : "error"} style={{ marginBottom: 0 }}>
                      {picked === q.answer ? "Correct! " : "Not quite. "}
                      <span className="muted">{q.explain}</span>
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      {view.targets.length ? (
        <>
          <h2 className="section-title" style={{ marginTop: 16 }}>Today&apos;s words</h2>
          <section className="card">
            {view.completedAt ? (
              <p style={{ marginTop: 0 }}>
                Done ✓ These words got a review from this text.{" "}
                <Link className="link" href="/review?today=1">Continue with flashcards →</Link>
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>Mark the words you did not recognise, then finish. This counts as a review.</p>
            )}
            <div className="compact">
              {view.targets.map((t) => {
                const rating = ratings[t.id] ?? "good";
                return (
                  <div className="compact-row" key={t.id}>
                    <span>
                      <strong>{t.korean}</strong> <span className="muted">{t.meaning}</span>
                      {!t.found ? <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>not found in the text</span> : null}
                    </span>
                    {view.completedAt ? null : (
                      <span className="seg">
                        <button type="button" className={rating === "again" ? "again small" : "secondary small"} onClick={() => setRatings((r) => ({ ...r, [t.id]: "again" }))}>
                          Forgot
                        </button>
                        <button type="button" className={rating === "good" ? "good small" : "secondary small"} onClick={() => setRatings((r) => ({ ...r, [t.id]: "good" }))}>
                          Knew
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {view.completedAt ? null : (
              <button type="button" className="wide" style={{ marginTop: 12 }} disabled={busy} onClick={finish}>
                Finish reading
              </button>
            )}
          </section>
        </>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {selected ? <div style={{ height: 220 }} /> : null}
    </>
  );
}
