export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        }
      : init?.headers,
  });
  if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    // session expired or password was changed: go to the login page and come back here afterwards
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Please log in.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
