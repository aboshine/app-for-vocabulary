"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import type { PlanView } from "@/lib/plan-service";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function percent(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export default function TodayPage() {
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PlanView>("/api/plan")
      .then(setPlan)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const empty = plan && plan.deck.total === 0;
  const nextStep = plan?.steps.find((s) => !s.done && !s.optional) ?? plan?.steps.find((s) => !s.done);

  return (
    <main>
      <div className="header">
        <h1>Today</h1>
        {plan ? <span className="badge">~{plan.plan.minutes} min a day</span> : null}
      </div>
      <Status loading={!plan && !error} error={error}>
        {empty ? (
          <section className="card">
            <p>No vocabulary yet.</p>
            <p className="muted">Pick a theme with ready-made TOPIK words, or add your own.</p>
            <Link className="cta" href="/learn">Choose a theme</Link>
            <Link className="cta secondary-cta" href="/vocabulary/new">Add your first word</Link>
          </section>
        ) : null}
        {plan && !empty ? (
          <>
            <section className="card hero">
              <div className="hero-top">
                <span className={plan.streak.todayDone ? "flame" : "flame off"}>🔥 {plan.streak.current}</span>
                <div className="hero-text">
                  <p>
                    <strong>
                      {plan.complete
                        ? "Today's plan is done. 잘했어요!"
                        : plan.streak.todayDone
                          ? "Today counts. Finish the plan if you can."
                          : plan.streak.atRisk
                            ? `Keep your ${plan.streak.current}-day streak alive`
                            : "Start a streak today"}
                    </strong>
                  </p>
                  <p className="muted">
                    {plan.streak.todayDone
                      ? `${plan.reviewedToday} cards today · best streak ${plan.streak.best}`
                      : `${Math.max(0, plan.streakMin - plan.reviewedToday)} more cards make today count`}
                  </p>
                </div>
              </div>
              <div className="dots" aria-label="This week">
                {plan.week.map((d, i) => (
                  <span key={d.day} className={["dot", d.active ? "active" : "", d.today ? "today" : "", d.future ? "future" : ""].join(" ")}>
                    <i />
                    {WEEKDAYS[i]}
                  </span>
                ))}
              </div>
            </section>

            {nextStep && !plan.complete ? (
              <Link className="cta" href={nextStep.href}>
                {nextStep.title}{plan.minutesLeft ? ` · ~${plan.minutesLeft} min left` : ""} →
              </Link>
            ) : null}

            <h2 className="section-title">Today&apos;s plan</h2>
            <section className="card" style={{ marginBottom: 16, paddingTop: 4, paddingBottom: 4 }}>
              {plan.steps.map((step) => (
                <Link className={step.done ? "step done" : "step"} href={step.href} key={step.key}>
                  <span className="check">{step.done ? "✓" : ""}</span>
                  <span className="step-body">
                    <p className="step-title">{step.title}</p>
                    <p className="muted">{step.detail}{step.optional && !step.done ? " · optional" : ""}</p>
                  </span>
                  {!step.done ? <span className="go">Go →</span> : null}
                </Link>
              ))}
            </section>

            {plan.lastWeekly ? (
              <section className="card notice" style={{ marginBottom: 16 }}>
                <p style={{ margin: 0 }}>
                  <strong>
                    Last weekly check: {plan.lastWeekly.score}/{plan.lastWeekly.total}
                    {plan.lastWeekly.delta !== 0 ? ` · new words ${plan.lastWeekly.delta > 0 ? "+" : ""}${plan.lastWeekly.delta}/day` : ""}
                  </strong>
                </p>
                <p className="muted" style={{ margin: "4px 0 0" }}>{plan.lastWeekly.message}</p>
                <p style={{ margin: "6px 0 0" }}>
                  <Link className="link" href="/weekly">{plan.weeklyDue ? "Take this week's check →" : "See results →"}</Link>
                </p>
              </section>
            ) : null}

            {plan.weakCount > 0 ? (
              <>
                <h2 className="section-title">Words that will not stick ({plan.weakCount})</h2>
                <section className="compact card" style={{ marginBottom: 8 }}>
                  {plan.weak.map((word) => (
                    <div className="compact-row" key={word.id}>
                      <div>
                        <strong>{word.korean}</strong>
                        <p className="muted" style={{ margin: 0 }}>{word.meaning}</p>
                      </div>
                      <div className="row">
                        <span className="badge">{Math.round(word.successRate * 100)}%</span>
                        <Link className="link" href={`/vocabulary/${word.id}?help=1`}>Help me remember</Link>
                      </div>
                    </div>
                  ))}
                </section>
                <Link className="cta secondary-cta" href="/review?weak=1">Practise these words</Link>
              </>
            ) : null}

            <h2 className="section-title">Progress</h2>
            <section className="grid" style={{ marginBottom: 16 }}>
              <Stat label="Learned" value={String(plan.deck.learned)} />
              <Stat label="Learning" value={String(plan.deck.learning)} />
              <Stat label="New, waiting" value={String(plan.deck.new)} />
              <Stat label="New words a day" value={String(plan.plan.newPerDay)} />
              <Stat label="7-day accuracy" value={percent(plan.retention.days7)} />
              <Stat label="30-day accuracy" value={percent(plan.retention.days30)} />
            </section>
            <h2 className="section-title">More practice</h2>
            <section className="grid">
              <Link className="card" href="/tutor?tab=write"><strong>✍️ Write</strong><p className="muted" style={{ margin: 0 }}>Teacher corrects you</p></Link>
              <Link className="card" href="/listen"><strong>🎧 Listen</strong><p className="muted" style={{ margin: 0 }}>Type what you hear</p></Link>
              <Link className="card" href="/tutor"><strong>💬 Ask</strong><p className="muted" style={{ margin: 0 }}>Any question</p></Link>
              <Link className="card" href="/weekly"><strong>📝 Weekly check</strong><p className="muted" style={{ margin: 0 }}>{plan.weeklyDue ? "Ready now" : "Results"}</p></Link>
            </section>
          </>
        ) : null}
      </Status>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <section className="card">
      <p className="muted">{label}</p>
      <p className="stat">{value}</p>
    </section>
  );
}
