"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VocabForm, type VocabFormValues } from "@/components/VocabForm";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

export default function NewWordPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/categories")
      .then(setCategories)
      .catch((err) => setError(err.message));
  }, []);

  async function onSubmit(values: VocabFormValues) {
    await api("/api/vocabulary", { method: "POST", body: JSON.stringify(values) });
    router.push("/vocabulary");
  }

  return (
    <main>
      <div className="header"><h1>Add word</h1></div>
      <Status loading={!categories && !error} error={error}>
        {categories ? <VocabForm categories={categories} onSubmit={onSubmit} submitLabel="Create" /> : null}
      </Status>
    </main>
  );
}
