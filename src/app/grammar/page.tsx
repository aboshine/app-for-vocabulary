"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

type Category = { id: string; name: string };
type Grammar = {
  id: string;
  title: string;
  meaning: string;
  structure: string;
  tags: string;
  learningState: string;
  category: Category | null;
};

export default function GrammarPage() {
  const [items, setItems] = useState<Grammar[] | null>(null);
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

  const loadItems = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    const query = qRef.current.trim();
    if (query) params.set("q", query);
    if (categoryId) params.set("categoryId", categoryId);
    if (state) params.set("state", state);
    try {
      setItems(await api<Grammar[]>(`/api/grammar?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [categoryId, state]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function remove(id: string) {
    if (!confirm("Delete this grammar point?")) return;
    try {
      await api(`/api/grammar/${id}`, { method: "DELETE" });
      setItems((prev) => prev?.filter((item) => item.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <main>
      <div className="header">
        <h1>Grammar</h1>
        <div className="row">
          <Link href="/grammar/review">Review</Link>
          <Link href="/grammar/new">Add grammar</Link>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          placeholder="Search title, meaning, or structure"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void loadItems()}
        />
        <button className="secondary" type="button" onClick={() => void loadItems()}>Search</button>
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
      <Status loading={!items && !error} error={error} empty={items?.length === 0} emptyText="No grammar matches.">
        <div className="list">
          {items?.map((item) => (
            <article className="card" key={item.id}>
              <Link href={`/grammar/${item.id}`}>
                <h2 className="word-title">{item.title}</h2>
                <p>{item.meaning}</p>
              </Link>
              <p className="muted">
                <span className="badge">{item.learningState}</span>
                {item.structure ? ` · ${item.structure}` : ""}
                {item.category ? ` · ${item.category.name}` : ""}
                {item.tags ? ` · ${item.tags}` : ""}
              </p>
              <div className="row">
                <Link href={`/grammar/${item.id}`}>Open</Link>
                <Link href={`/grammar/${item.id}/edit`}>Edit</Link>
                <button className="secondary" type="button" onClick={() => remove(item.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </Status>
    </main>
  );
}
