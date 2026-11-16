"use client";

import { useEffect, useState } from "react";

/** Password status on the Settings page. Plain fetch: this must work even when the session is gone. */
export function AccessSection() {
  const [state, setState] = useState<{ protected: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/login")
      .then((r) => r.json())
      .then(setState)
      .catch(() => undefined);
  }, []);

  async function logout() {
    await fetch("/api/login", { method: "DELETE" }).catch(() => undefined);
    window.location.href = "/login";
  }

  if (!state) return null;
  return (
    <section className="card form">
      <h2 className="section-title" style={{ margin: 0 }}>Access</h2>
      {state.protected ? (
        <>
          <p className="muted" style={{ margin: 0 }}>The app is protected by a password. This device is logged in.</p>
          <button type="button" className="secondary" onClick={() => void logout()}>Log out on this device</button>
        </>
      ) : (
        <>
          <p className="error" style={{ margin: 0 }}>No password. Anyone who has the link can open and change your cards.</p>
          <ol className="steps">
            <li>In your hosting&apos;s environment variables add <code>APP_PASSWORD</code> with a password you choose.</li>
            <li>Redeploy. The app will ask for the password once on each device.</li>
          </ol>
        </>
      )}
    </section>
  );
}
