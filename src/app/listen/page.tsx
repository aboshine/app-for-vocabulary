"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import { isTypingAnswerCorrect } from "@/lib/review-modes";
import { speakKorean, stopSpeaking } from "@/lib/speech";

type Word = { id: string; korean: string; meaning: string; exampleSentence: string };

/** Listening round: hear a word, type it. Uses the phone's built-in Korean voice. */
export default function ListenPage() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const [noVoice, setNoVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setError(null);
    setWords(null);
    try {
      setWords(await api<Word[]>("/api/listen"));
      setIndex(0);
      setRight(0);
      setTyped("");
      setChecked(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    return () => stopSpeaking();
  }, []);

  const word = words && index < words.length ? words[index] : null;

  function play(slow = false) {
    if (!word) return;
    if (!speakKorean(word.korean, slow ? 0.6 : 0.9)) setNoVoice(true);
    inputRef.current?.focus();
  }

  function check(event: FormEvent) {
    event.preventDefault();
    if (!word || checked !== null) return;
    const correct = isTypingAnswerCorrect(typed, word.korean);
    setChecked(correct);
    if (correct) setRight((n) => n + 1);
    // saved in the background; a failed save must not block the round
    void api("/api/listen", { method: "POST", body: JSON.stringify({ vocabularyId: word.id, correct }) }).catch(() => undefined);
  }

  function next() {
    setIndex((i) => i + 1);
    setTyped("");
    setChecked(null);
  }

  const finished = words !== null && words.length > 0 && index >= words.length;

  return (
    <main>
      <div className="header">
        <h1>Listening</h1>
        {word ? <span className="muted">{index + 1}/{words!.length}</span> : <Link href="/">Back</Link>}
      </div>
      <Status loading={!words && !error} error={error}>
        {noVoice ? <p className="card error">This browser has no speech voice. Try Chrome or Safari on your phone.</p> : null}
        {words && words.length === 0 ? (
          <section className="card">
            <p>No studied words yet.</p>
            <p className="muted">Review some words first; listening uses the words you already started.</p>
            <Link className="cta" href="/review?today=1">Go to review</Link>
          </section>
        ) : null}
        {word ? (
          <section className="card">
            <button type="button" className="secondary listen-play" onClick={() => play()}>🔊 Play</button>
            <div className="row" style={{ margin: "8px 0 12px" }}>
              <button type="button" className="secondary small" onClick={() => play(true)}>🐢 Slower</button>
            </div>
            <form className="form" onSubmit={check}>
              <input
                ref={inputRef}
                className="typing-input"
                lang="ko"
                autoComplete="off"
                autoCapitalize="off"
                value={typed}
                readOnly={checked !== null}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type what you hear"
              />
              {checked === null ? (
                <div className="row">
                  <button type="submit" style={{ flex: 1 }} disabled={!typed.trim()}>Check</button>
                  <button type="button" className="secondary" onClick={() => { setTyped(""); setChecked(false); void api("/api/listen", { method: "POST", body: JSON.stringify({ vocabularyId: word.id, correct: false }) }).catch(() => undefined); }}>
                    I can&apos;t hear it
                  </button>
                </div>
              ) : null}
            </form>
            {checked !== null ? (
              <>
                <p style={{ marginBottom: 4 }}>
                  <span className="badge">{checked ? "Correct ✓" : "Not quite"}</span>
                </p>
                <p className="prompt" style={{ margin: 0 }}>{word.korean}</p>
                <p className="muted" style={{ marginTop: 2 }}>{word.meaning}</p>
                {word.exampleSentence ? (
                  <p className="ko-small">
                    {word.exampleSentence}{" "}
                    <button type="button" className="icon" aria-label="Play sentence" onClick={() => speakKorean(word.exampleSentence)}>▶</button>
                  </p>
                ) : null}
                <button type="button" className="wide" autoFocus onClick={next}>{index + 1 < words!.length ? "Next" : "Finish"}</button>
              </>
            ) : null}
            <div className="bar"><span style={{ width: `${(index / words!.length) * 100}%` }} /></div>
          </section>
        ) : null}
        {finished ? (
          <section className="card">
            <p className="muted" style={{ margin: 0 }}>Round done</p>
            <p className="big-score">{right}/{words!.length}</p>
            <div className="row">
              <button type="button" onClick={() => void load()}>Another round</button>
              <Link className="link" href="/">Back to today&apos;s plan</Link>
            </div>
          </section>
        ) : null}
      </Status>
    </main>
  );
}
