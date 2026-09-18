"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

type Category = { id: string; name: string };
type Word = {
  id: string;
  korean: string;
  meaning: string;
  tags: string;
  learningState: string;
  category: Category | null;
};

export default function VocabularyPage() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qRef = useRef(q);
  qRef.current = q;

  useEffect(() => {
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const loadWords = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    const query = qRef.current.trim();
    if (query) params.set("q", query);
    if (categoryId) params.set("categoryId", categoryId);
    if (state) params.set("state", state);
    try {
      setWords(await api<Word[]>(`/api/vocabulary?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [categoryId, state]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  async function remove(id: string) {
    if (!confirm("Delete this word?")) return;
    try {
      await api(`/api/vocabulary/${id}`, { method: "DELETE" });
      setWords((prev) => prev?.filter((word) => word.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Vocabulary</h1>
        <div className="row">
          <Link href="/vocabulary/import">Import</Link>
          <Link href="/vocabulary/new">Add word</Link>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          placeholder="Search Korean or meaning"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void loadWords()}
        />
        <button className="secondary" type="button" onClick={() => void loadWords()}>Search</button>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All states</option>
          <option value="new">New</option>
          <option value="learning">Learning</option>
          <option value="learned">Learned</option>
        </select>
      </div>
      <Status loading={!words && !error} error={error} empty={words?.length === 0} emptyText="No words match.">
        <div className="list">
          {words?.map((word) => (
            <article className="card" key={word.id}>
              <Link href={`/vocabulary/${word.id}`}>
                <h2 className="word-title">{word.korean}</h2>
                <p>{word.meaning}</p>
              </Link>
              <p className="muted">
                <span className="badge">{word.learningState}</span>
                {word.category ? ` · ${word.category.name}` : ""}
                {word.tags ? ` · ${word.tags}` : ""}
              </p>
              <div className="row">
                <Link href={`/vocabulary/${word.id}`}>Open</Link>
                <Link href={`/vocabulary/${word.id}/edit`}>Edit</Link>
                <button className="secondary" type="button" onClick={() => remove(word.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </Status>
    </main>
  );
}
