"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { speakKorean } from "@/lib/speech";
import type { LessonView } from "@/lib/tutor-service";

export default function LessonPage() {
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showTr, setShowTr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(regenerate = false) {
    const key = new URLSearchParams(window.location.search).get("key") ?? "";
    setLoading(true);
    setError(null);
    try {
      setLesson(await api<LessonView>("/api/tutor/lessons", { method: "POST", body: JSON.stringify({ key, regenerate }) }));
      setAnswers({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the lesson");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function finish() {
    if (!lesson) return;
    setBusy(true);
    setError(null);
    try {
      setLesson(await api<LessonView>(`/api/tutor/lessons/${lesson.id}`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const p = lesson?.payload;
  const answered = p ? p.exercises.filter((_, i) => answers[i] !== undefined).length : 0;
  const right = p ? p.exercises.filter((q, i) => answers[i] === q.answer).length : 0;
  const allAnswered = p ? answered === p.exercises.length : false;

  return (
    <main>
      <div className="header">
        <h1>Grammar lesson</h1>
        <Link href="/tutor?tab=lessons">Back</Link>
      </div>
      {loading ? <p className="muted card">Your teacher is writing the lesson… (10–30 s the first time)</p> : null}
      {error ? (
        <section className="card" style={{ marginBottom: 12 }}>
          <p className="error" style={{ marginTop: 0 }}>{error}</p>
          <button type="button" className="secondary" onClick={() => void load()}>Try again</button>
        </section>
      ) : null}
      {lesson && p && !loading ? (
        <>
          <section className="card" style={{ marginBottom: 12 }}>
            <p className="prompt" style={{ fontSize: "1.6rem" }}>{p.title}</p>
            <p className="answer" style={{ fontSize: "1.1rem" }}>{p.meaning}</p>
          </section>

          <h2 className="section-title">How to build it</h2>
          <section className="card" style={{ marginBottom: 12 }}><p className="pre">{p.structure}</p></section>

          <h2 className="section-title">When to use it</h2>
          <section className="card" style={{ marginBottom: 12 }}>
            <p className="pre">{p.explanation}</p>
            {p.compare ? <p className="pre good-text" style={{ marginTop: 10 }}>≈ {p.compare}</p> : null}
          </section>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title" style={{ margin: 0 }}>Examples</h2>
            <button type="button" className="secondary small" onClick={() => setShowTr((v) => !v)}>{showTr ? "Hide translation" : "Show translation"}</button>
          </div>
          <section className="card" style={{ margin: "10px 0 12px" }}>
            {p.examples.map((example, i) => (
              <div className="lesson-ex" key={i}>
                <p className="ko-small">
                  {example.ko}{" "}
                  <button type="button" className="icon" aria-label="Play" onClick={() => speakKorean(example.ko)}>▶</button>
                </p>
                {showTr ? <p className="muted">{example.tr}</p> : null}
              </div>
            ))}
          </section>

          {p.mistake ? <p className="card notice" style={{ marginBottom: 12 }}>⚠ {p.mistake}</p> : null}

          {p.exercises.length ? (
            <>
              <h2 className="section-title">Practice</h2>
              <div className="list" style={{ marginBottom: 12 }}>
                {p.exercises.map((q, qi) => {
                  const chosen = answers[qi];
                  return (
                    <section className="card" key={qi}>
                      <p style={{ marginTop: 0 }}><strong>{qi + 1}.</strong> {q.q}</p>
                      <div className="options">
                        {q.options.map((option, oi) => {
                          const cls = ["secondary", "option"];
                          if (chosen !== undefined && oi === q.answer) cls.push("right");
                          else if (chosen === oi) cls.push("wrong");
                          return (
                            <button
                              type="button"
                              key={oi}
                              className={cls.join(" ")}
                              disabled={chosen !== undefined}
                              onClick={() => setAnswers((current) => ({ ...current, [qi]: oi }))}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {chosen !== undefined && q.explain ? <p className="muted" style={{ marginBottom: 0 }}>{q.explain}</p> : null}
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}

          {lesson.completedAt ? (
            <section className="card notice">
              <p style={{ marginTop: 0 }}><strong>Lesson done ✓</strong> It is now a grammar card and will come back in review.</p>
              <div className="row">
                {lesson.grammarId ? <Link className="link" href={`/grammar/${lesson.grammarId}`}>Open the card</Link> : null}
                <Link className="link" href="/tutor?tab=lessons">Next lesson →</Link>
                <Link className="link" href="/">Today&apos;s plan</Link>
              </div>
            </section>
          ) : (
            <>
              {allAnswered && p.exercises.length ? <p className="muted">{right}/{p.exercises.length} right.{right < Math.ceil(p.exercises.length * 0.6) ? " Read the explanation once more before you finish." : ""}</p> : null}
              <button type="button" className="wide" disabled={busy || (!allAnswered && p.exercises.length > 0)} onClick={() => void finish()}>
                {allAnswered || !p.exercises.length ? "Finish lesson" : `Answer all exercises (${answered}/${p.exercises.length})`}
              </button>
            </>
          )}
          <button type="button" className="secondary small" style={{ marginTop: 16 }} disabled={busy} onClick={() => void load(true)}>
            Explain it differently (new lesson)
          </button>
        </>
      ) : null}
    </main>
  );
}
