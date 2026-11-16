"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import type { WeeklyKind, WeeklySummary } from "@/lib/weekly";

type PublicQuestion = { kind: WeeklyKind; prompt: string; options: string[] };
type OpenCheck = { id: string; questions: PublicQuestion[] };
type State = {
  due: boolean;
  open: OpenCheck | null;
  history: Array<{ id: string; score: number; total: number; completedAt: string; message: string }>;
};
type Result = { id: string; score: number; total: number; summary: WeeklySummary | null };

const LABEL: Record<WeeklyKind, string> = {
  "ko-choice": "What does it mean?",
  "meaning-choice": "Which Korean word is it?",
  typing: "Type it in Korean",
  grammar: "Grammar: choose the right answer",
};

export default function WeeklyPage() {
  const [state, setState] = useState<State | null>(null);
  const [check, setCheck] = useState<OpenCheck | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<State>("/api/weekly")
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const opened = await api<OpenCheck>("/api/weekly", { method: "POST" });
      setCheck(opened);
      setAnswers([]);
      setIndex(0);
      setTyped("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function answer(value: string) {
    if (!check || busy) return;
    const next = [...answers, value];
    setAnswers(next);
    setTyped("");
    if (next.length < check.questions.length) {
      setIndex(next.length);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Result>(`/api/weekly/${check.id}`, { method: "POST", body: JSON.stringify({ answers: next }) }));
      setCheck(null);
    } catch (err) {
      // keep the answers so "Try again" can resend them
      setError(err instanceof Error ? err.message : "Could not save the check");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!check) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Result>(`/api/weekly/${check.id}`, { method: "POST", body: JSON.stringify({ answers }) }));
      setCheck(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the check");
    } finally {
      setBusy(false);
    }
  }

  const question = check && answers.length < check.questions.length ? check.questions[index] : null;
  const summary = result?.summary ?? null;
  const missed = summary?.rows.filter((r) => !r.correct) ?? [];

  return (
    <main>
      <div className="header">
        <h1>Weekly check</h1>
        {check ? <span className="muted">{Math.min(answers.length + 1, check.questions.length)}/{check.questions.length}</span> : <Link href="/">Back</Link>}
      </div>
      <Status loading={!state && !error} error={null}>
        {error ? <p className="error card" style={{ marginBottom: 12 }}>{error}</p> : null}

        {result ? (
          <>
            <section className="card" style={{ marginBottom: 12 }}>
              <p className="muted" style={{ margin: 0 }}>Your result</p>
              <p className="big-score">{result.score}/{result.total}</p>
              {summary ? <p style={{ marginBottom: 0 }}>{summary.adjustment.message}</p> : null}
              {summary && summary.adjustment.delta !== 0 ? (
                <p className="muted" style={{ marginBottom: 0 }}>
                  New words a day: {summary.adjustment.newPerDay - summary.adjustment.delta} → <strong>{summary.adjustment.newPerDay}</strong>
                </p>
              ) : null}
            </section>
            {summary?.comment ? (
              <section className="card notice" style={{ marginBottom: 12 }}>
                <p className="muted" style={{ marginTop: 0 }}>Your teacher says</p>
                <p className="pre">{summary.comment}</p>
              </section>
            ) : null}
            {missed.length ? (
              <>
                <h2 className="section-title">Missed ({missed.length}) — back in today&apos;s review</h2>
                <section className="compact card" style={{ marginBottom: 12 }}>
                  {missed.map((row, i) => (
                    <div className="compact-row" key={i}>
                      <div>
                        <strong>{row.kind === "ko-choice" || row.kind === "grammar" ? row.prompt : row.answer}</strong>
                        <p className="muted" style={{ margin: 0 }}>{row.kind === "ko-choice" || row.kind === "grammar" ? row.answer : row.prompt}</p>
                        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>you answered: {row.given || "—"}</p>
                      </div>
                      <Link className="link" href={row.grammarId ? `/grammar/${row.grammarId}` : `/vocabulary/${row.vocabularyId}?help=1`}>
                        {row.grammarId ? "Rule" : "Help"}
                      </Link>
                    </div>
                  ))}
                </section>
                <Link className="cta" href="/review?today=1">Review the missed words now</Link>
              </>
            ) : (
              <p className="card notice">Nothing missed. 대단해요!</p>
            )}
            <Link className="cta secondary-cta" href="/">Back to today&apos;s plan</Link>
          </>
        ) : null}

        {question && !result ? (
          <section className="card">
            <p className="muted" style={{ marginTop: 0 }}>{LABEL[question.kind]}</p>
            <p className="prompt">{question.prompt}</p>
            {question.kind === "typing" ? (
              <form
                className="form"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void answer(typed);
                }}
              >
                <input
                  className="typing-input"
                  lang="ko"
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="한국어"
                />
                <div className="row">
                  <button type="submit" disabled={busy} style={{ flex: 1 }}>Answer</button>
                  <button type="button" className="secondary" disabled={busy} onClick={() => void answer("")}>I don&apos;t know</button>
                </div>
              </form>
            ) : (
              <div className="options">
                {question.options.map((option) => (
                  <button type="button" className="secondary option" disabled={busy} key={option} onClick={() => void answer(option)}>
                    {option}
                  </button>
                ))}
                <button type="button" className="secondary option" disabled={busy} onClick={() => void answer("")}>I don&apos;t know</button>
              </div>
            )}
            <div className="bar"><span style={{ width: `${(answers.length / (check?.questions.length || 1)) * 100}%` }} /></div>
          </section>
        ) : null}

        {check && !question && !result ? (
          <section className="card">
            <p>{busy ? "Checking your answers…" : "Your answers were not saved yet."}</p>
            {!busy ? <button type="button" className="wide" onClick={() => void resend()}>Try again</button> : null}
          </section>
        ) : null}

        {state && !check && !result ? (
          <>
            <section className="card" style={{ marginBottom: 16 }}>
              <p><strong>{state.due ? "This week's check is ready" : "A short test on what you studied"}</strong></p>
              <p className="muted">
                12–20 quick questions on this week&apos;s words, a few older ones and the grammar lessons you finished. No hints. Words you miss come
                back into review today, and the result sets how many new words you get next week.
              </p>
              <button type="button" className="wide" disabled={busy} onClick={() => void start()}>
                {busy ? "Preparing…" : state.open ? "Continue the check" : state.due ? "Start the check" : "Take it now anyway"}
              </button>
            </section>
            {state.history.length ? (
              <>
                <h2 className="section-title">Earlier checks</h2>
                <div className="compact card">
                  {state.history.map((item) => (
                    <div className="compact-row" key={item.id}>
                      <div>
                        <strong>{item.score}/{item.total}</strong>
                        <p className="muted" style={{ margin: 0 }}>{item.message}</p>
                      </div>
                      <span className="muted nowrap">{new Date(item.completedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </Status>
    </main>
  );
}
