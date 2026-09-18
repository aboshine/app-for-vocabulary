export function Status({
  loading,
  error,
  empty,
  emptyText,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (loading) return <p className="muted">Loading…</p>;
  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      {empty ? <p className="muted">{emptyText ?? "Nothing here yet."}</p> : children}
    </>
  );
}
