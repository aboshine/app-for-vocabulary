"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

interface Detail {
  id: string;
  korean: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  notes: string;
  tags: string;
  category: { id: string; name: string } | null;
  learningState: string;
  status: string;
  intervalMinutes: number;
  intervalLabel: string;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  stats: { totalReviews: number; correct: number; incorrect: number; successRate: number | null };
  history: Array<{
    id: string;
    createdAt: string;
    mode: string;
    rating: string;
    intervalAfter: number;
    intervalLabel: string;
  }>;
}

export default function VocabDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Detail>(`/api/vocabulary/${id}/detail`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [id]);

  async function remove() {
    if (!confirm("Delete this word?")) return;
    setBusy(true);
    try {
      await api(`/api/vocabulary/${id}`, { method: "DELETE" });
      router.push("/vocabulary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Word</h1>
        <Link href="/vocabulary">Back</Link>
      </div>
      <Status loading={!data && !error} error={error}>
        {data ? (
          <>
            <section className="card" style={{ marginBottom: 12 }}>
              <p className="prompt" style={{ fontSize: "1.8rem" }}>{data.korean}</p>
              <p className="answer">{data.meaning}</p>
              <p><span className="badge">{data.status}</span></p>
            </section>
            <section className="card" style={{ marginBottom: 12 }}>
              <dl className="detail-list">
                <div><dt>Example</dt><dd>{data.exampleSentence || "—"}</dd></div>
                <div><dt>Translation</dt><dd>{data.exampleTranslation || "—"}</dd></div>
                <div><dt>Category</dt><dd>{data.category?.name || "—"}</dd></div>
                <div><dt>Tags</dt><dd>{data.tags || "—"}</dd></div>
                <div><dt>Notes</dt><dd>{data.notes || "—"}</dd></div>
                <div><dt>Learning state</dt><dd>{data.status}</dd></div>
                <div><dt>Interval</dt><dd>{data.intervalLabel}</dd></div>
                <div><dt>Next review</dt><dd>{new Date(data.nextReviewAt).toLocaleString()}</dd></div>
                <div><dt>Total reviews</dt><dd>{data.stats.totalReviews}</dd></div>
                <div><dt>Correct / incorrect</dt><dd>{data.stats.correct} / {data.stats.incorrect}</dd></div>
                <div>
                  <dt>Success rate</dt>
                  <dd>{data.stats.successRate == null ? "—" : `${Math.round(data.stats.successRate * 100)}%`}</dd>
                </div>
              </dl>
            </section>
            <div className="row" style={{ marginBottom: 16 }}>
              <Link className="cta" href={`/review?word=${data.id}`} style={{ margin: 0, flex: 1 }}>
                Review this word now
              </Link>
            </div>
            <div className="row" style={{ marginBottom: 16 }}>
              <Link href={`/vocabulary/${data.id}/edit`}>Edit</Link>
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
                      <p className="muted">{item.mode}</p>
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
