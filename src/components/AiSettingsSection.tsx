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

  useEffect(() => {
    Promise.all([api<AiSettings>("/api/ai/settings"), api<AiStatus>("/api/ai/status")])
      .then(([s, a]) => {
        setSettings(s);
        setAi(a);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load AI settings"));
  }, []);

  async function save(patch: Partial<AiSettings>) {
    setSaved(false);
    setError(null);
    try {
      setSettings(await api<AiSettings>("/api/ai/settings", { method: "PATCH", body: JSON.stringify(patch) }));
      setSaved(true);
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
                <option value="en">English</option>
              </select>
            </label>
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
            <p className="muted" style={{ marginBottom: 0 }}>
              Connected: {ai.provider} · texts: {ai.smartModel} · quick tasks: {ai.fastModel}
            </p>
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
