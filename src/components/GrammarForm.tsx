"use client";

import { FormEvent, useState } from "react";
import { LIMITS, type GrammarExample } from "@/lib/validation";

export interface GrammarFormValues {
  title: string;
  meaning: string;
  explanation: string;
  structure: string;
  examples: GrammarExample[];
  notes: string;
  categoryId: string;
  tags: string;
}

function emptyExample(): GrammarExample {
  return { sentence: "", translation: "" };
}

export function GrammarForm({
  initial,
  categories,
  onSubmit,
  submitLabel,
}: {
  initial?: Partial<GrammarFormValues>;
  categories: { id: string; name: string }[];
  onSubmit: (values: GrammarFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState<GrammarFormValues>({
    title: initial?.title ?? "",
    meaning: initial?.meaning ?? "",
    explanation: initial?.explanation ?? "",
    structure: initial?.structure ?? "",
    examples: initial?.examples?.length ? initial.examples : [emptyExample()],
    notes: initial?.notes ?? "",
    categoryId: initial?.categoryId ?? "",
    tags: initial?.tags ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GrammarFormValues>(key: K, value: GrammarFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateExample(index: number, key: keyof GrammarExample, value: string) {
    setValues((current) => ({
      ...current,
      examples: current.examples.map((example, i) =>
        i === index ? { ...example, [key]: value } : example,
      ),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.title.trim() || !values.meaning.trim()) {
      setError("Title and meaning are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        meaning: values.meaning.trim(),
        explanation: values.explanation.trim(),
        structure: values.structure.trim(),
        examples: values.examples
          .map((example) => ({
            sentence: example.sentence.trim(),
            translation: example.translation.trim(),
          }))
          .filter((example) => example.sentence || example.translation),
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
        Title
        <input
          required
          maxLength={LIMITS.title}
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
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
        Structure
        <input
          maxLength={LIMITS.structure}
          value={values.structure}
          onChange={(e) => update("structure", e.target.value)}
        />
      </label>
      <label>
        Explanation
        <textarea
          maxLength={LIMITS.explanation}
          value={values.explanation}
          onChange={(e) => update("explanation", e.target.value)}
        />
      </label>
      <div>
        <p>Example sentences</p>
        {values.examples.map((example, index) => (
          <div className="card" key={index} style={{ marginBottom: 8, display: "grid", gap: 8 }}>
            <label>
              Sentence
              <input
                maxLength={LIMITS.example}
                value={example.sentence}
                onChange={(e) => updateExample(index, "sentence", e.target.value)}
              />
            </label>
            <label>
              Translation
              <input
                maxLength={LIMITS.example}
                value={example.translation}
                onChange={(e) => updateExample(index, "translation", e.target.value)}
              />
            </label>
            {values.examples.length > 1 ? (
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  update(
                    "examples",
                    values.examples.filter((_, i) => i !== index),
                  )
                }
              >
                Remove example
              </button>
            ) : null}
          </div>
        ))}
        <button
          className="secondary"
          type="button"
          onClick={() => update("examples", [...values.examples, emptyExample()])}
        >
          Add example
        </button>
      </div>
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
