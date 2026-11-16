"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Breakdown } from "@/components/Breakdown";
import { api } from "@/lib/api";
import type { ChatMessage, ExplainPayload, WritingFeedback } from "@/lib/ai/tutor-prompts";

type Tab = "ask" | "write" | "explain" | "lessons";
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
    if (wanted === "explain" || wanted === "lessons" || wanted === "ask" || wanted === "write") setTab(wanted);
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
        <button type="button" className={tab === "write" ? "on" : ""} onClick={() => choose("write")}>Write</button>
        <button type="button" className={tab === "explain" ? "on" : ""} onClick={() => choose("explain")}>Explain</button>
        <button type="button" className={tab === "lessons" ? "on" : ""} onClick={() => choose("lessons")}>Grammar</button>
      </div>
      {/* Ask and Explain stay mounted so nothing typed is lost when switching tabs; the others load on first open. */}
      <div hidden={tab !== "ask"}><Ask /></div>
      {tab === "write" ? <Write /> : null}
      <div hidden={tab !== "explain"}><Explain /></div>
      {tab === "lessons" ? <Lessons /> : null}
    </main>
  );
}

const CHAT_KEY = "kv-tutor-chat";

/** The chat is kept on this device (browser storage), newest 30 messages. */
function loadChat(): ChatMessage[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHAT_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m): m is ChatMessage => Boolean(m) && typeof m.content === "string" && (m.role === "user" || m.role === "teacher"))
      .slice(-30);
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]) {
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
    // storage full or blocked: the chat simply is not remembered
  }
}

function Ask() {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const setMessages = (next: ChatMessage[]) => {
    setMessagesState(next);
    saveChat(next);
  };

  useEffect(() => {
    setMessagesState(loadChat());
  }, []);

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

type WritingTask = { words: Array<{ id: string; korean: string; meaning: string }>; grammar: string };

function Write() {
  const [task, setTask] = useState<WritingTask | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ feedback: WritingFeedback; credited: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTask() {
    setError(null);
    try {
      setTask(await api<WritingTask>("/api/tutor/writing"));
      setText("");
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void loadTask();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!task || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<{ feedback: WritingFeedback; credited: number }>("/api/tutor/writing", {
          method: "POST",
          body: JSON.stringify({ text, wordIds: task.words.map((w) => w.id), grammar: task.grammar }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check");
    } finally {
      setBusy(false);
    }
  }

  if (!task) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const f = result?.feedback;

  return (
    <>
      <section className="card" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          {task.words.length ? "Write 2–3 sentences in Korean. Use these words:" : "Write 2–3 sentences in Korean about your day."}
        </p>
        {task.words.map((w) => {
          const status = f?.words.find((x) => x.korean === w.korean);
          return (
            <p key={w.id} style={{ margin: "4px 0" }}>
              <strong>{w.korean}</strong> <span className="muted">{w.meaning}</span>
              {status ? <span className="badge" style={{ marginLeft: 8 }}>{status.correct ? "used ✓" : status.used ? "used wrong" : "not used"}</span> : null}
            </p>
          );
        })}
        {task.grammar ? <p className="muted" style={{ marginBottom: 0 }}>Bonus: try {task.grammar}</p> : null}
      </section>
      {!f ? (
        <form className="form" onSubmit={submit}>
          <textarea lang="ko" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="한국어로 써 보세요…" />
          {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
          <button type="submit" disabled={busy || !text.trim()}>{busy ? "Your teacher is reading… (5–20 s)" : "Check my sentences"}</button>
          <button type="button" className="secondary small" disabled={busy} onClick={() => void loadTask()}>Other words</button>
        </form>
      ) : (
        <>
          {f.sentences.map((s, i) => (
            <div className="breakdown" key={i}>
              {s.ok ? (
                <p className="ko-small"><strong>{s.original}</strong> <span className="good-text">✓</span></p>
              ) : (
                <>
                  <p className="ko-small" style={{ textDecoration: "line-through", color: "var(--again)" }}>{s.original}</p>
                  <p className="ko-small"><strong>{s.corrected}</strong></p>
                  {s.explain ? <p className="muted" style={{ marginBottom: 0 }}>{s.explain}</p> : null}
                </>
              )}
            </div>
          ))}
          {f.natural ? <p className="card" style={{ marginBottom: 12 }}><span className="muted">More natural:</span> {f.natural}</p> : null}
          {f.overall ? <p className="card notice" style={{ marginBottom: 12 }}>{f.overall}</p> : null}
          {result.credited ? <p className="muted">{result.credited} word{result.credited === 1 ? "" : "s"} counted as reviewed.</p> : null}
          <div className="row">
            <button type="button" onClick={() => void loadTask()}>New task</button>
            <button type="button" className="secondary" onClick={() => setResult(null)}>Rewrite this one</button>
          </div>
        </>
      )}
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
