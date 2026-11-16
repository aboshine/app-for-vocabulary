"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Breakdown } from "@/components/Breakdown";
import { api } from "@/lib/api";
import type { ChatMessage, ExplainPayload } from "@/lib/ai/tutor-prompts";

type Tab = "ask" | "explain" | "lessons";
type AiStatus = { configured: boolean };
type LessonList = {
  level: number;
  next: string | null;
  items: Array<{ key: string; pattern: string; level: number; lessonId: string | null; done: boolean }>;
};

const STARTERS = [
  "What is the difference between 은/는 and 이/가?",
  "Give me a small exercise on today's grammar",
  "Check my sentence: 저는 어제 학교에 가요",
  "How do I remember words better?",
];

export default function TutorPage() {
  const [tab, setTab] = useState<Tab>("ask");
  const [ai, setAi] = useState<AiStatus | null>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted === "explain" || wanted === "lessons" || wanted === "ask") setTab(wanted);
    api<AiStatus>("/api/ai/status").then(setAi).catch(() => undefined);
  }, []);

  function choose(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `/tutor?tab=${next}`);
  }

  return (
    <main>
      <div className="header">
        <h1>Tutor</h1>
      </div>
      {ai && !ai.configured ? (
        <section className="card" style={{ marginBottom: 12 }}>
          <p><strong>AI is not connected yet.</strong></p>
          <p className="muted">The teacher needs a (free) Gemini key. See <Link href="/settings" className="link">Settings</Link>.</p>
        </section>
      ) : null}
      <div className="tabs" role="tablist">
        <button type="button" className={tab === "ask" ? "on" : ""} onClick={() => choose("ask")}>Ask</button>
        <button type="button" className={tab === "explain" ? "on" : ""} onClick={() => choose("explain")}>Explain text</button>
        <button type="button" className={tab === "lessons" ? "on" : ""} onClick={() => choose("lessons")}>Grammar</button>
      </div>
      {/* All three stay mounted so a chat is not lost when switching tabs. */}
      <div hidden={tab !== "ask"}><Ask /></div>
      <div hidden={tab !== "explain"}><Explain /></div>
      <div hidden={tab !== "lessons"}><Lessons /></div>
    </main>
  );
}

function Ask() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const { reply } = await api<{ reply: string }>("/api/tutor/chat", { method: "POST", body: JSON.stringify({ messages: next }) });
      setMessages([...next, { role: "teacher", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The teacher did not answer");
      setMessages(messages); // give the question back so it can be sent again
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {messages.length === 0 ? (
        <>
          <p className="muted">Ask anything about Korean: a word, a grammar point, your own sentence. Any language is fine.</p>
          <div className="chips">
            {STARTERS.map((s) => (
              <button type="button" key={s} onClick={() => void send(s)}>{s}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="chat">
          {messages.map((m, i) => (
            <div className={`bubble ${m.role}`} key={i}>{m.content}</div>
          ))}
          {busy ? <div className="bubble teacher muted">…</div> : null}
          <div ref={endRef} />
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
      <form
        className="row"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your question…" maxLength={1500} />
        <button type="submit" disabled={busy || !draft.trim()}>{busy ? "…" : "Send"}</button>
      </form>
      {messages.length ? (
        <button type="button" className="secondary small" style={{ marginTop: 10 }} onClick={() => setMessages([])}>New chat</button>
      ) : null}
    </>
  );
}

function Explain() {
  const [text, setText] = useState("");
  const [data, setData] = useState<ExplainPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setData(await api<ExplainPayload>("/api/tutor/explain", { method: "POST", body: JSON.stringify({ text }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explain");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="form" onSubmit={run} style={{ marginBottom: 12 }}>
        <label>
          Paste Korean text (a sentence, a message, a line from a song)
          <textarea lang="ko" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="예: 시간이 있으면 같이 영화를 보러 갈까요?" />
        </label>
        <button type="submit" disabled={busy || !text.trim()}>{busy ? "Breaking it down… (5–20 s)" : "Explain it"}</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {data ? <Breakdown data={data} /> : null}
    </>
  );
}

function Lessons() {
  const [list, setList] = useState<LessonList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LessonList>("/api/tutor/lessons")
      .then(setList)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!list) return <p className="muted">Loading…</p>;
  const next = list.items.find((item) => item.key === list.next);
  const doneCount = list.items.filter((item) => item.done).length;

  return (
    <>
      {next ? (
        <section className="card" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: 0 }}>Next lesson · TOPIK {next.level}</p>
          <p className="word-title" style={{ margin: "4px 0 10px" }}>{next.pattern}</p>
          <Link className="cta" style={{ margin: 0 }} href={`/tutor/lesson?key=${next.key}`}>Start the lesson (about 6 min)</Link>
        </section>
      ) : (
        <p className="card notice">All lessons done. 축하해요!</p>
      )}
      <p className="muted">{doneCount}/{list.items.length} done. A finished lesson becomes a grammar card and comes back in review. You can open any lesson, in any order.</p>
      {[1, 2, 3].map((level) => (
        <div key={level}>
          <h2 className="section-title">TOPIK {level}</h2>
          <div className="compact card" style={{ marginBottom: 12 }}>
            {list.items.filter((item) => item.level === level).map((item) => (
              <Link className="compact-row" href={`/tutor/lesson?key=${item.key}`} key={item.key}>
                <strong className="wrap-anywhere">{item.pattern}</strong>
                <span className="badge nowrap">{item.done ? "done ✓" : item.lessonId ? "opened" : item.key === list.next ? "next" : "open"}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
