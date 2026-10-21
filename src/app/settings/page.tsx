"use client";

import { useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import { LEVEL_GUIDE, LEVELS } from "@/lib/ai/prompts";
import type { AppSettings } from "@/lib/settings";

type AiStatus = { configured: boolean; provider: string | null; smartModel: string | null; fastModel: string | null };

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([api<AppSettings>("/api/settings"), api<AiStatus>("/api/ai/status")])
      .then(([s, a]) => {
        setSettings(s);
        setAi(a);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  async function save(patch: Partial<AppSettings>) {
    setSaved(false);
    try {
      setSettings(await api<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Settings</h1>
        {saved ? <span className="good-text">Saved ✓</span> : null}
      </div>
      <Status loading={!settings && !error} error={error}>
        {settings ? (
          <section className="card form" style={{ marginBottom: 12 }}>
            <label>
              Your level
              <select value={settings.level} onChange={(e) => save({ level: Number(e.target.value) as AppSettings["level"] })}>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{LEVEL_GUIDE[level].label}</option>
                ))}
              </select>
            </label>
            <label>
              Translations and explanations in
              <select value={settings.lang} onChange={(e) => save({ lang: e.target.value as AppSettings["lang"] })}>
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
          </section>
        ) : null}
        {ai ? (
          <section className="card">
            <p style={{ marginTop: 0 }}><strong>AI</strong></p>
            {ai.configured ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Connected: {ai.provider} · texts: {ai.smartModel} · quick tasks: {ai.fastModel}
              </p>
            ) : (
              <>
                <p className="muted">Not connected. To use the free Google Gemini tier:</p>
                <ol className="steps">
                  <li>Open <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> and sign in with Google.</li>
                  <li>Press “Create API key” and copy it.</li>
                  <li>Add <code>GEMINI_API_KEY=your-key</code> to the <code>.env</code> file (or your hosting&apos;s environment variables) and restart the app.</li>
                </ol>
              </>
            )}
          </section>
        ) : null}
        <p className="muted" style={{ fontSize: "0.85rem" }}>Data is stored in a local SQLite file.</p>
      </Status>
    </main>
  );
}
