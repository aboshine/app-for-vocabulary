"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WordHelp } from "@/lib/ai/tutor-prompts";
import { speakKorean } from "@/lib/speech";

/** "Help me remember": the AI teacher's memory hook, similar words and fresh examples for one word. */
export function WordHelpCard({ vocabularyId, autoStart = false }: { vocabularyId: string; autoStart?: boolean }) {
  const [help, setHelp] = useState<WordHelp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setHelp(await api<WordHelp>("/api/tutor/word", { method: "POST", body: JSON.stringify({ vocabularyId }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get help");
    } finally {
      setBusy(false);
    }
  }, [vocabularyId]);

  useEffect(() => {
    if (autoStart) void load();
  }, [autoStart, load]);

  return (
    <section className="card" style={{ marginBottom: 12 }}>
      {!help ? (
        <>
          <button type="button" className="secondary wide" disabled={busy} onClick={() => void load()}>
            {busy ? "Your teacher is thinking… (5–15 s)" : "🧠 Help me remember this word"}
          </button>
          {error ? <p className="error" style={{ marginBottom: 0 }}>{error}</p> : null}
        </>
      ) : (
        <dl className="detail-list">
          {help.hook ? <div><dt>Memory hook</dt><dd>{help.hook}</dd></div> : null}
          {help.parts ? <div><dt>How the word is built</dt><dd>{help.parts}</dd></div> : null}
          {help.collocations.length ? (
            <div><dt>Often used with</dt><dd>{help.collocations.map((c) => <div key={c}>{c}</div>)}</dd></div>
          ) : null}
          {help.confusedWith.length ? (
            <div>
              <dt>Do not mix up with</dt>
              <dd>{help.confusedWith.map((c) => <div key={c.korean}><strong>{c.korean}</strong> ({c.meaning}): {c.difference}</div>)}</dd>
            </div>
          ) : null}
          {help.examples.length ? (
            <div>
              <dt>More examples</dt>
              <dd>
                {help.examples.map((e) => (
                  <div key={e.ko} style={{ marginBottom: 6 }}>
                    {e.ko} <button type="button" className="icon" aria-label="Play" onClick={() => speakKorean(e.ko)}>▶</button>
                    <div className="muted">{e.tr}</div>
                  </div>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
