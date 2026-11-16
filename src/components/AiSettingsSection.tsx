"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LEVEL_GUIDE, LEVELS } from "@/lib/ai/prompts";
import type { AiSettings } from "@/lib/ai-settings";

type AiStatus = { configured: boolean; provider: string | null; smartModel: string | null; fastModel: string | null };

/** AI reading / word pack settings, shown on the Settings page under the review settings. */
export function AiSettingsSection() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tr, setTr] = useState<{ lang: string; langName: string; remaining: number } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [probes, setProbes] = useState<Array<{ model: string; role: string; ok: boolean; firstMs: number | null; totalMs: number; error: string }> | null>(null);
  const [probing, setProbing] = useState(false);

  async function testSpeed() {
    setProbing(true);
    try {
      setProbes(await api("/api/ai/test"));
    } catch (err) {
      setProbes([{ model: "test", role: "", ok: false, firstMs: null, totalMs: 0, error: err instanceof Error ? err.message : "failed" }]);
    } finally {
      setProbing(false);
    }
  }
  const [trTotal, setTrTotal] = useState(0);

  const loadTranslate = () => api<{ lang: string; langName: string; remaining: number }>("/api/vocabulary/translate").then(setTr).catch(() => undefined);

  /** Translate card meanings batch by batch until none are left (or an error stops it). */
  async function translateAll() {
    if (!tr || translating) return;
    setTranslating(true);
    setError(null);
    setTrTotal(tr.remaining);
    try {
      let remaining = tr.remaining;
      while (remaining > 0) {
        const step = await api<{ translated: number; lang: string; langName: string; remaining: number }>("/api/vocabulary/translate", { method: "POST" });
        setTr(step);
        if (step.remaining >= remaining) break; // no progress: stop instead of looping forever
        remaining = step.remaining;
      }
    } catch (err) {
      setError(err instanceof Error ? `${err.message} You can press the button again to continue.` : "Translation stopped");
    } finally {
      setTranslating(false);
    }
  }

  useEffect(() => {
    Promise.all([api<AiSettings>("/api/ai/settings"), api<AiStatus>("/api/ai/status")])
      .then(([s, a]) => {
        setSettings(s);
        setAi(a);
        void loadTranslate();
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load AI settings"));
  }, []);

  async function save(patch: Partial<AiSettings>) {
    setSaved(false);
    setError(null);
    try {
      setSettings(await api<AiSettings>("/api/ai/settings", { method: "PATCH", body: JSON.stringify(patch) }));
      setSaved(true);
      if (patch.lang) void loadTranslate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <>
      <section className="card form">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title" style={{ margin: 0 }}>AI reading &amp; word packs</h2>
          {saved ? <span className="good-text">Saved ✓</span> : null}
        </div>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        {settings ? (
          <>
            <label>
              Your level
              <select value={settings.level} onChange={(e) => save({ level: Number(e.target.value) as AiSettings["level"] })}>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{LEVEL_GUIDE[level].label}</option>
                ))}
              </select>
            </label>
            <label>
              Translations and explanations in
              <select value={settings.lang} onChange={(e) => save({ lang: e.target.value as AiSettings["lang"] })}>
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </select>
            </label>
            {settings.lang === "kk" ? (
              <p className="muted" style={{ margin: 0 }}>
                Kazakh: the teacher compares Korean grammar with Kazakh where they match. AI is a bit less
                reliable in Kazakh than in Russian, so switch back if translations look odd.
              </p>
            ) : null}
            {tr && tr.remaining > 0 ? (
              <div className="card notice" style={{ margin: 0 }}>
                <p style={{ marginTop: 0 }}>
                  {translating
                    ? `Translating… ${Math.max(0, trTotal - tr.remaining)}/${trTotal} done. Keep this page open.`
                    : `${tr.remaining} card${tr.remaining === 1 ? " has" : "s have"} a meaning that is not in ${tr.langName}.`}
                </p>
                <button type="button" className="wide" disabled={translating || (ai !== null && !ai.configured)} onClick={() => void translateAll()}>
                  {translating ? "Working…" : `Translate my cards to ${tr.langName}`}
                </button>
                <p className="muted" style={{ marginBottom: 0 }}>This replaces the old meanings. It cannot be undone, except by translating again into another language.</p>
              </div>
            ) : null}
            <label>
              Target words per daily text
              <select value={settings.targetsPerText} onChange={(e) => save({ targetsPerText: Number(e.target.value) })}>
                {[5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>
              Words per new pack
              <select value={settings.packSize} onChange={(e) => save({ packSize: Number(e.target.value) })}>
                {[5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </>
        ) : !error ? (
          <p className="muted" style={{ margin: 0 }}>Loading…</p>
        ) : null}
      </section>
      {ai ? (
        <section className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>AI connection</h2>
          {ai.configured ? (
            <>
              <p className="muted">
                Connected: {ai.provider} · texts: {ai.smartModel} · quick tasks: {ai.fastModel}
              </p>
              <button type="button" className="secondary" disabled={probing} onClick={() => void testSpeed()}>
                {probing ? "Testing… (up to 15 s)" : "Test AI speed"}
              </button>
              {probes?.map((p) => (
                <p key={p.model} style={{ margin: "8px 0 0" }} className="wrap-anywhere">
                  <strong>{p.model}</strong> <span className="muted">({p.role})</span>
                  <br />
                  {p.ok
                    ? `first words after ${((p.firstMs ?? 0) / 1000).toFixed(1)} s, done in ${(p.totalMs / 1000).toFixed(1)} s`
                    : <span className="error">failed after {(p.totalMs / 1000).toFixed(1)} s: {p.error}</span>}
                </p>
              ))}
            </>
          ) : (
            <>
              <p className="muted">Not connected. To use the free Google Gemini tier:</p>
              <ol className="steps">
                <li>
                  Create a key at{" "}
                  <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                    aistudio.google.com/apikey
                  </a>.
                </li>
                <li>Add it as <code>GEMINI_API_KEY</code> in your hosting&apos;s environment variables (or <code>.env</code> locally).</li>
                <li>Redeploy / restart the app.</li>
              </ol>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
