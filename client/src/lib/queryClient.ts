import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  let userHeaders: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("growth_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { id?: number; role?: string };
        if (parsed.id !== undefined) {
          userHeaders["x-user-id"] = String(parsed.id);
        }
        if (parsed.role) {
          userHeaders["x-user-role"] = parsed.role;
        }
      } catch {
        // ignore invalid local storage
      }
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...userHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Произошла ошибка запроса");
  }

  return res;
}