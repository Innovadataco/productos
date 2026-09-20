export async function fetchApi(path: string, options?: RequestInit) {
  const baseUrl = typeof window === "undefined" ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5001" : "";
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
