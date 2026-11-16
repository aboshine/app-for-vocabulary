"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "Wrong password." : "Could not log in. Try again.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // only follow links back into this app
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Korean Vocab</h1>
      </div>
      <form className="card form" onSubmit={submit}>
        <label>
          Password
          <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        <button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Log in"}</button>
        <p className="muted" style={{ margin: 0 }}>You stay logged in on this device for about six months.</p>
      </form>
    </main>
  );
}
