"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

interface DashboardData {
  today: { overdue: number; due: number; new: number; recommended: number };
  progress: { reviewedToday: number; remaining: number; learning: number; learned: number; total: number };
  retention: { days7: number | null; days30: number | null };
  difficult: Array<{ id: string; korean: string; meaning: string; successRate: number; reviews: number }>;
  recent: Array<{
    id: string;
    vocabularyId: string;
    korean: string;
    meaning: string;
    rating: string;
    direction: string;
    createdAt: string;
  }>;
  categories: Array<{ id: string | null; name: string; total: number; learned: number }>;
}

function percent(value: number | null): string {
  return value == null ? "Not enough data" : `${Math.round(value * 100)}%`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardData>("/api/stats")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const empty = data && data.progress.total === 0;

  return (
    <main>
      <div className="header">
        <h1>Today</h1>
      </div>
      <Status loading={!data && !error} error={error}>
        {empty ? (
          <section className="card">
            <p>No vocabulary yet.</p>
            <p className="muted">Add a few words, then start a review session.</p>
            <Link className="cta" href="/vocabulary/new">Add your first word</Link>
          </section>
        ) : null}
        {data && !empty ? (
          <>
            <section className="grid" style={{ marginBottom: 12 }}>
              <Stat label="Overdue" value={data.today.overdue} />
              <Stat label="Due today" value={data.today.due} />
              <Stat label="New cards" value={data.today.new} />
              <Stat label="Recommended" value={data.today.recommended} />
            </section>
            <Link className="cta" href="/review?today=1">Start Today&apos;s Review</Link>
            <h2 className="section-title">Progress</h2>
            <section className="grid" style={{ marginBottom: 16 }}>
              <Stat label="Today's reviewed" value={data.progress.reviewedToday} />
              <Stat label="Today's remaining" value={data.progress.remaining} />
              <Stat label="Learning" value={data.progress.learning} />
              <Stat label="Learned" value={data.progress.learned} />
              <Stat label="Total vocabulary" value={data.progress.total} />
            </section>
            <h2 className="section-title">Retention</h2>
            <section className="grid" style={{ marginBottom: 16 }}>
              <section className="card">
                <p className="muted">7-day accuracy</p>
                <p className="stat">{percent(data.retention.days7)}</p>
              </section>
              <section className="card">
                <p className="muted">30-day accuracy</p>
                <p className="stat">{percent(data.retention.days30)}</p>
              </section>
            </section>
            <h2 className="section-title">Difficult words</h2>
            {data.difficult.length === 0 ? (
              <p className="muted">No difficult words yet. Review more cards to see this list.</p>
            ) : (
              <div className="compact card" style={{ marginBottom: 16 }}>
                {data.difficult.map((word) => (
                  <div className="compact-row" key={word.id}>
                    <div>
                      <strong>{word.korean}</strong>
                      <p className="muted">{word.meaning}</p>
                    </div>
                    <div className="row">
                      <span className="badge">{Math.round(word.successRate * 100)}%</span>
                      <Link href={`/vocabulary/${word.id}`}>Open</Link>
                      <Link href={`/review?word=${word.id}`}>Review</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h2 className="section-title">Recent activity</h2>
            {data.recent.length === 0 ? (
              <p className="muted">No reviews yet today.</p>
            ) : (
              <div className="compact card" style={{ marginBottom: 16 }}>
                {data.recent.map((item) => (
                  <div className="compact-row" key={item.id}>
                    <Link href={`/vocabulary/${item.vocabularyId}`}>
                      <strong>{item.korean}</strong>
                      <p className="muted">{item.meaning}</p>
                    </Link>
                    <span className="badge">{item.rating} · {item.direction}</span>
                  </div>
                ))}
              </div>
            )}
            <h2 className="section-title">Categories</h2>
            {data.categories.length === 0 ? (
              <p className="muted">No categories yet.</p>
            ) : (
              <div className="compact card">
                {data.categories.map((category) => (
                  <div className="compact-row" key={category.id ?? "none"}>
                    <strong>{category.name}</strong>
                    <span className="muted">{category.learned}/{category.total} learned</span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <section className="card">
      <p className="muted">{label}</p>
      <p className="stat">{value}</p>
    </section>
  );
}
