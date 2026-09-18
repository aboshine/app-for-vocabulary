"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GrammarForm, type GrammarFormValues } from "@/components/GrammarForm";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";
import { parseStoredExamples } from "@/lib/validation";

type Grammar = GrammarFormValues & { id: string; examples: string | GrammarFormValues["examples"] };

export default function EditGrammarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<GrammarFormValues | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Grammar>(`/api/grammar/${id}`),
      api<{ id: string; name: string }[]>("/api/categories"),
    ])
      .then(([nextItem, nextCategories]) => {
        setItem({
          title: nextItem.title,
          meaning: nextItem.meaning,
          explanation: nextItem.explanation,
          structure: nextItem.structure,
          examples: Array.isArray(nextItem.examples)
            ? nextItem.examples
            : parseStoredExamples(nextItem.examples),
          notes: nextItem.notes,
          categoryId: nextItem.categoryId ?? "",
          tags: nextItem.tags,
        });
        setCategories(nextCategories);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function onSubmit(values: GrammarFormValues) {
    await api(`/api/grammar/${id}`, { method: "PUT", body: JSON.stringify(values) });
    router.push(`/grammar/${id}`);
  }

  return (
    <main>
      <div className="header"><h1>Edit grammar</h1></div>
      <Status loading={!item && !error} error={error}>
        {item ? (
          <GrammarForm initial={item} categories={categories} onSubmit={onSubmit} submitLabel="Save" />
        ) : null}
      </Status>
    </main>
  );
}
