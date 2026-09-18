"use client";

import { FormEvent, useEffect, useState } from "react";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

type Category = { id: string; name: string; _count?: { words: number } };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setCategories(await api<Category[]>("/api/categories"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/categories", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function rename(id: string, current: string) {
    const next = prompt("Rename category", current);
    if (!next?.trim()) return;
    try {
      await api(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ name: next }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category?")) return;
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <main>
      <div className="header"><h1>Categories</h1></div>
      <form className="row" onSubmit={create} style={{ marginBottom: 16 }}>
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          required
        />
        <button type="submit">Add</button>
      </form>
      <Status loading={!categories && !error} error={error} empty={categories?.length === 0} emptyText="No categories yet.">
        <div className="list">
          {categories?.map((category) => (
            <article className="card row" key={category.id} style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{category.name}</strong>
                <p className="muted">{category._count?.words ?? 0} words</p>
              </div>
              <div className="row">
                <button className="secondary" type="button" onClick={() => rename(category.id, category.name)}>Rename</button>
                <button className="secondary" type="button" onClick={() => remove(category.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </Status>
    </main>
  );
}
