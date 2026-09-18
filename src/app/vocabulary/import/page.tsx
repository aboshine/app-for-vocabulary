"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DuplicateMode, PreviewRow } from "@/lib/import/plan";

interface PreviewResponse {
  rows: PreviewRow[];
}

interface ImportResponse {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  rows: PreviewRow[];
}

export default function ImportPage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [summary, setSummary] = useState<Omit<ImportResponse, "rows"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function runPreview(source: string) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const result = await api<PreviewResponse>("/api/vocabulary/import/preview", {
        method: "POST",
        body: JSON.stringify({ text: source }),
      });
      setPreview(result.rows);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const source = await file.text();
    setText(source);
    await runPreview(source);
  }

  async function onImport() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<ImportResponse>("/api/vocabulary/import", {
        method: "POST",
        body: JSON.stringify({ text, duplicateMode: mode }),
      });
      setPreview(result.rows);
      setSummary({
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const actionableCount =
    preview?.filter((row) => {
      if (row.errors.length > 0 || row.fileDuplicate) return false;
      if (row.dbDuplicate && mode === "skip") return false;
      return true;
    }).length ?? 0;

  return (
    <main>
      <div className="header">
        <h1>Import</h1>
        <Link href="/vocabulary">Back</Link>
      </div>
      <section className="card" style={{ marginBottom: 12 }}>
        <p className="muted">
          Columns: korean, meaning, exampleSentence, exampleTranslation, category, tags, notes
        </p>
        <label>
          CSV file
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        <label>
          Paste from Excel / Google Sheets
          <textarea
            className="paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"korean\tmeaning\tcategory\n물\twater\tFood"}
          />
        </label>
        <div className="row">
          <button type="button" className="secondary" disabled={busy || !text.trim()} onClick={() => void runPreview(text)}>
            {busy ? "Working…" : "Preview"}
          </button>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 12 }}>
        <p>If a word already exists:</p>
        <div className="row">
          <label className="choice">
            <input type="radio" name="dup" checked={mode === "skip"} onChange={() => setMode("skip")} />
            Skip duplicates
          </label>
          <label className="choice">
            <input type="radio" name="dup" checked={mode === "update"} onChange={() => setMode("update")} />
            Update existing
          </label>
        </div>
        <button type="button" disabled={busy || !preview || actionableCount === 0} onClick={() => void onImport()}>
          Import {actionableCount > 0 ? `${actionableCount} rows` : ""}
        </button>
      </section>
      {error ? <p className="error">{error}</p> : null}
      {summary ? (
        <section className="grid" style={{ marginBottom: 12 }}>
          <Stat label="Imported" value={summary.imported} />
          <Stat label="Updated" value={summary.updated} />
          <Stat label="Skipped" value={summary.skipped} />
          <Stat label="Failed" value={summary.failed} />
        </section>
      ) : null}
      {preview && preview.length === 0 ? <p className="muted">No rows to import.</p> : null}
      {preview && preview.length > 0 ? (
        <div className="table-wrap card">
          <table className="preview-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Korean</th>
                <th>Meaning</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={row.errors.length ? "invalid" : row.fileDuplicate || row.dbDuplicate ? "duplicate" : ""}
                >
                  <td>{row.rowNumber}</td>
                  <td>{row.korean || "—"}</td>
                  <td>{row.meaning || "—"}</td>
                  <td>{row.category || "—"}</td>
                  <td>{statusLabel(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}

function statusLabel(row: PreviewRow): string {
  if (row.errors.length) return row.errors.join("; ");
  if (row.fileDuplicate) return "Duplicate in file";
  if (row.dbDuplicate) return "Exists in database";
  return "Ready";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <section className="card">
      <p className="muted">{label}</p>
      <p className="stat">{value}</p>
    </section>
  );
}
