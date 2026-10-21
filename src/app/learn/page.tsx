"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import type { PackWord } from "@/lib/ai/prompts";
import type { ThemeProgress } from "@/lib/curriculum";

type LearnData = { currentTheme: string; packSize: number; themes: ThemeProgress[] };
type AiStatus = { configured: boolean };

export default function LearnPage() {
  const [data, setData] = useState<LearnData | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyTheme, setBusyTheme] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [learn, status] = await Promise.all([api<LearnData>("/api/learn"), api<AiStatus>("/api/ai/status")]);
      setData(learn);
      setAi(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPack(theme: string) {
    setBusyTheme(theme);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ added: string[] }>("/api/learn/pack", {
        method: "POST",
        body: JSON.stringify({ theme }),
      });
      setNotice(
        result.added.length
          ? `Added ${result.added.length} words: ${result.added.join(", ")}. Today's text will use them.`
          : "This theme is now your focus. All its words are already in your deck — generate more with AI below.",
      );
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyTheme(null);
    }
  }

  const current = data?.themes.find((t) => t.key === data.currentTheme);
  const others = data?.themes.filter((t) => t.key !== data.currentTheme) ?? [];

  return (
    <main>
      <div className="header">
        <h1>Learn</h1>
        <Link className="link" href="/categories">Categories</Link>
      </div>
      <Status loading={!data && !error} error={error}>
        {notice ? <p className="card notice">{notice}</p> : null}
        <section className="card" style={{ marginBottom: 12 }}>
          <p style={{ marginTop: 0 }}><strong>How it works</strong></p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Learn one theme at a time: add a pack of {data?.packSize ?? 8} words, read today&apos;s text built from
            them, then review the cards. Words from one situation are much easier to remember together.
          </p>
        </section>
        {current ? (
          <>
            <h2 className="section-title">Current focus</h2>
            <ThemeCard theme={current} packSize={data!.packSize} busy={busyTheme === current.key} onAdd={addPack} focused />
            <Link className="cta" href="/reading">Read today&apos;s text →</Link>
          </>
        ) : null}
        <h2 className="section-title">{current ? "Other themes" : "Pick a theme to start"}</h2>
        <div className="list">
          {others.map((theme) => (
            <ThemeCard key={theme.key} theme={theme} packSize={data!.packSize} busy={busyTheme === theme.key} onAdd={addPack} />
          ))}
        </div>
        <Generator aiReady={Boolean(ai?.configured)} themes={data?.themes ?? []} currentTheme={data?.currentTheme ?? ""} onSaved={load} />
      </Status>
    </main>
  );
}

function ThemeCard({
  theme,
  packSize,
  busy,
  onAdd,
  focused,
}: {
  theme: ThemeProgress;
  packSize: number;
  busy: boolean;
  onAdd: (key: string) => void;
  focused?: boolean;
}) {
  const pct = theme.total ? Math.round((theme.inDeck / theme.total) * 100) : 0;
  return (
    <section className={focused ? "card focus" : "card"} style={focused ? { marginBottom: 12 } : undefined}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="word-title" style={{ marginBottom: 0 }}>{theme.titleKo}</p>
          <p className="muted" style={{ margin: 0 }}>{theme.title}</p>
        </div>
        <span className="badge">TOPIK {theme.level}</span>
      </div>
      <div className="bar" aria-label={`${theme.inDeck} of ${theme.total} in deck`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted" style={{ margin: "4px 0 8px", fontSize: "0.85rem" }}>
        {theme.inDeck}/{theme.total} in deck · {theme.learned} learned
        {theme.preview.length ? ` · next: ${theme.preview.slice(0, 4).join(", ")}` : ""}
      </p>
      <button type="button" className={focused ? "wide" : "secondary wide"} disabled={busy} onClick={() => onAdd(theme.key)}>
        {busy ? "Adding…" : theme.remaining ? `Add next ${Math.min(packSize, theme.remaining)} words` : focused ? "All words added" : "Focus on this theme"}
      </button>
    </section>
  );
}

function Generator({
  aiReady,
  themes,
  currentTheme,
  onSaved,
}: {
  aiReady: boolean;
  themes: ThemeProgress[];
  currentTheme: string;
  onSaved: () => Promise<void>;
}) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(12);
  const [words, setWords] = useState<PackWord[] | null>(null);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [usedTopic, setUsedTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function suggest() {
    const value = topic.trim() || currentTheme;
    if (!value) {
      setError("Write a topic or pick a theme first.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await api<{ words: PackWord[] }>("/api/learn/generate", {
        method: "POST",
        body: JSON.stringify({ topic: value, count }),
      });
      setWords(result.words);
      setKeep(new Set(result.words.map((_, i) => i)));
      setUsedTopic(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!words) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = words.filter((_, i) => keep.has(i));
      const result = await api<{ added: string[] }>("/api/learn/save", {
        method: "POST",
        body: JSON.stringify({ topic: usedTopic, words: chosen }),
      });
      setDone(`Added ${result.added.length} words.`);
      setWords(null);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="section-title" style={{ marginTop: 20 }}>More words with AI</h2>
      <section className="card form">
        <p className="muted" style={{ margin: 0 }}>
          Pick a theme to extend it, or type any topic (e.g. “서울 생활”, “лаборатория”, “아르바이트 면접”).
        </p>
        <label>
          Topic
          <input
            list="theme-keys"
            placeholder={currentTheme ? `${themes.find((t) => t.key === currentTheme)?.titleKo ?? ""} (current theme)` : "Topic"}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <datalist id="theme-keys">
            {themes.map((t) => (
              <option key={t.key} value={t.key}>{t.titleKo} · {t.title}</option>
            ))}
          </datalist>
        </label>
        <label>
          How many
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[8, 12, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy || !aiReady} onClick={suggest}>
          {busy && !words ? "Thinking… (10–20 s)" : aiReady ? "Suggest words" : "Connect AI in Settings first"}
        </button>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        {done ? <p className="good-text" style={{ margin: 0 }}>{done}</p> : null}
      </section>
      {words ? (
        <section className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ marginTop: 0 }}>Untick words you don&apos;t want, then add.</p>
          <div className="compact">
            {words.map((word, i) => (
              <label className="compact-row choice" key={word.korean} style={{ alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={keep.has(i)}
                  onChange={(e) =>
                    setKeep((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.add(i);
                      else next.delete(i);
                      return next;
                    })
                  }
                />
                <span style={{ flex: 1 }}>
                  <strong>{word.korean}</strong> — {word.meaning}
                  {word.exampleSentence ? <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>{word.exampleSentence}</span> : null}
                </span>
              </label>
            ))}
          </div>
          <button type="button" className="wide" style={{ marginTop: 12 }} disabled={busy || keep.size === 0} onClick={save}>
            Add {keep.size} words to deck
          </button>
        </section>
      ) : null}
    </>
  );
}
