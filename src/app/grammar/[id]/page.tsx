"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import type { GrammarExample } from "@/lib/validation";

interface Detail {
  id: string;
  title: string;
  meaning: string;
  explanation: string;
  structure: string;
  examples: GrammarExample[];
  notes: string;
  tags: string;
  category: { id: string; name: string } | null;
  learningState: string;
  status: string;
  interval: number;
  intervalLabel: string;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  stats: { totalReviews: number; correct: number; incorrect: number; successRate: number | null };
  history: Array<{
    id: string;
    createdAt: string;
    rating: string;
    intervalAfter: number;
    intervalLabel: string;
  }>;
}

export default function GrammarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Detail>(`/api/grammar/${id}/detail`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  async function remove() {
    if (!confirm("Delete this grammar point?")) return;
    setBusy(true);
    try {
      await api(`/api/grammar/${id}`, { method: "DELETE" });
      router.push("/grammar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Grammar</h1>
        <Link href="/grammar">Back</Link>
      </div>
      <Status loading={!data && !error} error={error}>
        {data ? (
          <>
            <section className="card" style={{ marginBottom: 12 }}>
              <p className="prompt" style={{ fontSize: "1.8rem" }}>{data.title}</p>
              <p className="answer">{data.meaning}</p>
              {data.structure ? <p className="muted">{data.structure}</p> : null}
              <p><span className="badge">{data.status}</span></p>
            </section>
            <section className="card" style={{ marginBottom: 12 }}>
              <dl className="detail-list">
                <div><dt>Explanation</dt><dd>{data.explanation || "—"}</dd></div>
                <div><dt>Structure</dt><dd>{data.structure || "—"}</dd></div>
                <div><dt>Category</dt><dd>{data.category?.name || "—"}</dd></div>
                <div><dt>Tags</dt><dd>{data.tags || "—"}</dd></div>
                <div><dt>Notes</dt><dd>{data.notes || "—"}</dd></div>
                <div><dt>Learning state</dt><dd>{data.status}</dd></div>
                <div><dt>Interval</dt><dd>{data.intervalLabel}</dd></div>
                <div><dt>Next review</dt><dd>{new Date(data.nextReviewAt).toLocaleString()}</dd></div>
                <div>
                  <dt>Last reviewed</dt>
                  <dd>{data.lastReviewedAt ? new Date(data.lastReviewedAt).toLocaleString() : "—"}</dd>
                </div>
                <div><dt>Total reviews</dt><dd>{data.stats.totalReviews}</dd></div>
                <div><dt>Correct / incorrect</dt><dd>{data.stats.correct} / {data.stats.incorrect}</dd></div>
                <div>
                  <dt>Success rate</dt>
                  <dd>{data.stats.successRate == null ? "—" : `${Math.round(data.stats.successRate * 100)}%`}</dd>
                </div>
              </dl>
            </section>
            <h2 className="section-title">Example sentences</h2>
            {data.examples.length === 0 ? (
              <p className="muted">No examples yet.</p>
            ) : (
              <section className="card" style={{ marginBottom: 12 }}>
                {data.examples.map((example, index) => (
                  <div className="compact-row" key={`${example.sentence}-${index}`}>
                    <div>
                      <strong>{example.sentence || "—"}</strong>
                      <p className="muted">{example.translation || "—"}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}
            <div className="row" style={{ marginBottom: 16 }}>
              <Link className="cta" href="/grammar/review" style={{ margin: 0, flex: 1 }}>
                Review grammar
              </Link>
            </div>
            <div className="row" style={{ marginBottom: 16 }}>
              <Link href={`/grammar/${data.id}/edit`}>Edit</Link>
              <button className="secondary" type="button" disabled={busy} onClick={() => void remove()}>
                Delete
              </button>
            </div>
            <h2 className="section-title">Recent reviews</h2>
            {data.history.length === 0 ? (
              <p className="muted">No review history yet.</p>
            ) : (
              <div className="compact card">
                {data.history.map((item) => (
                  <div className="compact-row" key={item.id}>
                    <div>
                      <strong>{item.rating}</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>{item.intervalLabel}</div>
                      <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </Status>
    </main>
  );
}
