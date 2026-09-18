"use client";

import { FormEvent, useState } from "react";
import { LIMITS } from "@/lib/validation";

export interface VocabFormValues {
  korean: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  notes: string;
  categoryId: string;
  tags: string;
}

export function VocabForm({
  initial,
  categories,
  onSubmit,
  submitLabel,
}: {
  initial?: Partial<VocabFormValues>;
  categories: { id: string; name: string }[];
  onSubmit: (values: VocabFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState<VocabFormValues>({
    korean: initial?.korean ?? "",
    meaning: initial?.meaning ?? "",
    exampleSentence: initial?.exampleSentence ?? "",
    exampleTranslation: initial?.exampleTranslation ?? "",
    notes: initial?.notes ?? "",
    categoryId: initial?.categoryId ?? "",
    tags: initial?.tags ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof VocabFormValues>(key: K, value: VocabFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.korean.trim() || !values.meaning.trim()) {
      setError("Korean and meaning are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...values,
        korean: values.korean.trim(),
        meaning: values.meaning.trim(),
        exampleSentence: values.exampleSentence.trim(),
        exampleTranslation: values.exampleTranslation.trim(),
        notes: values.notes.trim(),
        tags: values.tags.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Korean
        <input
          required
          maxLength={LIMITS.korean}
          value={values.korean}
          onChange={(e) => update("korean", e.target.value)}
        />
      </label>
      <label>
        Meaning
        <input
          required
          maxLength={LIMITS.meaning}
          value={values.meaning}
          onChange={(e) => update("meaning", e.target.value)}
        />
      </label>
      <label>
        Example sentence
        <input
          maxLength={LIMITS.example}
          value={values.exampleSentence}
          onChange={(e) => update("exampleSentence", e.target.value)}
        />
      </label>
      <label>
        Example translation
        <input
          maxLength={LIMITS.example}
          value={values.exampleTranslation}
          onChange={(e) => update("exampleTranslation", e.target.value)}
        />
      </label>
      <label>
        Notes
        <textarea
          maxLength={LIMITS.notes}
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
        />
      </label>
      <label>
        Category
        <select value={values.categoryId} onChange={(e) => update("categoryId", e.target.value)}>
          <option value="">None</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags (comma-separated)
        <input
          maxLength={LIMITS.tags}
          value={values.tags}
          onChange={(e) => update("tags", e.target.value)}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
