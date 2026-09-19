"use client";

import { useCallback, useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import {
  DEFAULT_SETTINGS,
  MODE_FILTER_OPTIONS,
  MIXED_MODE_OPTIONS,
  NEW_WORD_PRESETS,
  REVIEW_TARGET_PRESETS,
  type LearningSettings,
} from "@/lib/settings";
import { SESSION_LIMITS, type SessionLimit } from "@/lib/review-session";
import type { ReviewMode } from "@/lib/review-modes";

type Category = { id: string; name: string };

function presetOrCustom(value: number, presets: readonly number[]): string {
  return presets.includes(value) ? String(value) : "custom";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<LearningSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [newPreset, setNewPreset] = useState("10");
  const [targetPreset, setTargetPreset] = useState("20");

  useEffect(() => {
    Promise.all([
      api<LearningSettings>("/api/settings"),
      api<Category[]>("/api/categories"),
    ])
      .then(([nextSettings, nextCategories]) => {
        setSettings(nextSettings);
        setCategories(nextCategories);
        setNewPreset(presetOrCustom(nextSettings.dailyNewWordLimit, NEW_WORD_PRESETS));
        setTargetPreset(presetOrCustom(nextSettings.dailyReviewTarget, REVIEW_TARGET_PRESETS));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const save = useCallback(async (next: LearningSettings) => {
    setSettings(next);
    setStatus("saving");
    setError(null);
    try {
      const saved = await api<LearningSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setSettings(saved);
      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("idle");
    }
  }, []);

  function update<K extends keyof LearningSettings>(key: K, value: LearningSettings[K]) {
    if (!settings) return;
    void save({ ...settings, [key]: value });
  }

  function toggleMixedMode(id: ReviewMode, checked: boolean) {
    if (!settings) return;
    const next = checked
      ? [...new Set([...settings.mixedModes, id])]
      : settings.mixedModes.filter((mode) => mode !== id);
    if (next.length === 0) return;
    void save({ ...settings, mixedModes: next });
  }

  return (
    <main>
      <div className="header">
        <h1>Settings</h1>
        <span className="muted">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Local only"}
        </span>
      </div>
      <Status loading={!settings && !error} error={error}>
        {settings ? (
          <div className="list">
            <section className="card form">
              <h2 className="section-title">Daily new words</h2>
              <label>
                New cards per day
                <select
                  value={newPreset}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewPreset(value);
                    if (value !== "custom") update("dailyNewWordLimit", Number(value));
                  }}
                >
                  {NEW_WORD_PRESETS.map((limit) => (
                    <option key={limit} value={String(limit)}>{limit}</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </label>
              {newPreset === "custom" ? (
                <label>
                  Custom limit
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={settings.dailyNewWordLimit}
                    onChange={(e) => update("dailyNewWordLimit", Number(e.target.value))}
                  />
                </label>
              ) : null}
            </section>

            <section className="card form">
              <h2 className="section-title">Review session</h2>
              <label>
                Default session size
                <select
                  value={String(settings.sessionLimit)}
                  onChange={(e) =>
                    update(
                      "sessionLimit",
                      (e.target.value === "all" ? "all" : Number(e.target.value)) as SessionLimit,
                    )
                  }
                >
                  {SESSION_LIMITS.map((limit) => (
                    <option key={String(limit)} value={String(limit)}>
                      {limit === "all" ? "All" : limit}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Default review mode
                <select
                  value={settings.defaultMode}
                  onChange={(e) => update("defaultMode", e.target.value as LearningSettings["defaultMode"])}
                >
                  {MODE_FILTER_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={settings.includeNew}
                  onChange={(e) => update("includeNew", e.target.checked)}
                />
                Include new cards in review by default
              </label>
              <label>
                Default category
                <select
                  value={settings.defaultCategoryId}
                  onChange={(e) => update("defaultCategoryId", e.target.value)}
                >
                  <option value="">All</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="card form">
              <h2 className="section-title">Mixed mode</h2>
              <p className="muted">Enabled modes rotate when Mixed is selected.</p>
              {MIXED_MODE_OPTIONS.map((option) => (
                <label className="choice" key={option.id}>
                  <input
                    type="checkbox"
                    checked={settings.mixedModes.includes(option.id)}
                    onChange={(e) => toggleMixedMode(option.id, e.target.checked)}
                  />
                  {option.label}
                </label>
              ))}
            </section>

            <section className="card form">
              <h2 className="section-title">Daily review target</h2>
              <label>
                Target reviews
                <select
                  value={targetPreset}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTargetPreset(value);
                    if (value !== "custom") update("dailyReviewTarget", Number(value));
                  }}
                >
                  {REVIEW_TARGET_PRESETS.map((limit) => (
                    <option key={limit} value={String(limit)}>{limit}</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </label>
              {targetPreset === "custom" ? (
                <label>
                  Custom target
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={settings.dailyReviewTarget}
                    onChange={(e) => update("dailyReviewTarget", Number(e.target.value))}
                  />
                </label>
              ) : null}
            </section>
            <p className="muted">Defaults: {DEFAULT_SETTINGS.dailyNewWordLimit} new / {DEFAULT_SETTINGS.sessionLimit} cards / Mixed.</p>
          </div>
        ) : null}
      </Status>
    </main>
  );
}
