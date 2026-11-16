"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MINUTE_PRESETS, PLAN_PRESETS } from "@/lib/plan";

type PlanInfo = { plan: { minutes: number; newPerDay: number; reviewTarget: number; grammarPerWeek: number } };
type Telegram = { configured: boolean; botName: string | null; connected: boolean; remindersOn: boolean };

/** Study plan size and Telegram reminders, shown on the Settings page. */
export function PlanSettingsSection() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [tg, setTg] = useState<Telegram | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api<PlanInfo>("/api/plan").then(setInfo).catch((err) => setError(err instanceof Error ? err.message : "Failed to load the plan"));
    api<Telegram>("/api/telegram").then(setTg).catch(() => undefined);
  }, []);

  async function setMinutes(minutes: number) {
    setBusy(true);
    setError(null);
    try {
      await api<PlanInfo>("/api/plan", { method: "PATCH", body: JSON.stringify({ dailyMinutes: minutes }) });
      // The fields above (new words, review target) just changed on the server: reload so they show the new values.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function telegram(action: "connect" | "disconnect" | "on" | "off") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      setTg(await api<Telegram>("/api/telegram", { method: "POST", body: JSON.stringify({ action }) }));
      if (action === "connect") setNote("Connected. Check Telegram: the bot sent you a message.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Telegram failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card form">
        <h2 className="section-title" style={{ margin: 0 }}>Study plan</h2>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        {note ? <p className="good-text" style={{ margin: 0 }}>{note}</p> : null}
        {info ? (
          <>
            <label>
              Time I have every day
              <select value={info.plan.minutes} disabled={busy} onChange={(e) => void setMinutes(Number(e.target.value))}>
                {MINUTE_PRESETS.map((m) => (
                  <option key={m} value={m}>
                    about {m} min ({PLAN_PRESETS[m].newWords} new words)
                  </option>
                ))}
              </select>
            </label>
            <p className="muted" style={{ margin: 0 }}>
              Now: {info.plan.newPerDay} new words a day, review target {info.plan.reviewTarget}. Choosing a time resets
              these two numbers. After that the weekly check moves new words up or down by itself.
            </p>
          </>
        ) : !error ? (
          <p className="muted" style={{ margin: 0 }}>Loading…</p>
        ) : null}
      </section>
      {tg ? (
        <section className="card form">
          <h2 className="section-title" style={{ margin: 0 }}>Telegram reminders</h2>
          {!tg.configured ? (
            <>
              <p className="muted" style={{ margin: 0 }}>Not set up. A bot will message you every morning with the plan, and in the evening if the streak is about to break.</p>
              <ol className="steps">
                <li>In Telegram open <code>@BotFather</code>, send <code>/newbot</code> and follow the steps. It gives you a token.</li>
                <li>Add the token as <code>TELEGRAM_BOT_TOKEN</code> in your hosting&apos;s environment variables, then redeploy.</li>
                <li>Open your new bot in Telegram and press <strong>Start</strong>.</li>
                <li>Come back here and press <strong>Connect</strong>.</li>
              </ol>
            </>
          ) : tg.connected ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Connected{tg.botName ? ` to @${tg.botName}` : ""}. Morning message about 09:00, evening warning about 21:00 (Korea time), only if the day is not done.
              </p>
              <label className="choice">
                <input type="checkbox" checked={tg.remindersOn} disabled={busy} onChange={(e) => void telegram(e.target.checked ? "on" : "off")} />
                Send me reminders
              </label>
              <button type="button" className="secondary" disabled={busy} onClick={() => void telegram("disconnect")}>Disconnect</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Bot{tg.botName ? ` @${tg.botName}` : ""} is ready. Open it in Telegram, press <strong>Start</strong> (or send any message), then press Connect.
              </p>
              <button type="button" disabled={busy} onClick={() => void telegram("connect")}>{busy ? "Connecting…" : "Connect"}</button>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
