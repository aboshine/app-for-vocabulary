"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GrammarForm, type GrammarFormValues } from "@/components/GrammarForm";
import { Status } from "@/components/Status";
import { api } from "@/lib/api";

export default function NewGrammarPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/categories")
      .then(setCategories)
      .catch((err) => setError(err.message));
  }, []);

  async function onSubmit(values: GrammarFormValues) {
    await api("/api/grammar", { method: "POST", body: JSON.stringify(values) });
    router.push("/grammar");
  }

  return (
    <main>
      <div className="header"><h1>Add grammar</h1></div>
      <Status loading={!categories && !error} error={error}>
        {categories ? <GrammarForm categories={categories} onSubmit={onSubmit} submitLabel="Create" /> : null}
      </Status>
    </main>
  );
}
