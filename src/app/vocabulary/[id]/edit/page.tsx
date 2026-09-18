"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VocabForm, type VocabFormValues } from "@/components/VocabForm";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

type Word = VocabFormValues & { id: string };

export default function EditWordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [word, setWord] = useState<Word | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Word>(`/api/vocabulary/${id}`),
      api<{ id: string; name: string }[]>("/api/categories"),
    ])
      .then(([nextWord, nextCategories]) => {
        setWord({ ...nextWord, categoryId: nextWord.categoryId ?? "" });
        setCategories(nextCategories);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function onSubmit(values: VocabFormValues) {
    await api(`/api/vocabulary/${id}`, { method: "PUT", body: JSON.stringify(values) });
    router.push(`/vocabulary/${id}`);
  }

  return (
    <main>
      <div className="header"><h1>Edit word</h1></div>
      <Status loading={!word && !error} error={error}>
        {word ? (
          <VocabForm initial={word} categories={categories} onSubmit={onSubmit} submitLabel="Save" />
        ) : null}
      </Status>
    </main>
  );
}
