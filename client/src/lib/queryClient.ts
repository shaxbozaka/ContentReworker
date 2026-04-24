import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to parse JSON error message, otherwise use a clean status message
    let message: string;
    try {
      const json = JSON.parse(text);
      message = json.message || json.error || `${res.status}: ${res.statusText}`;
    } catch {
      // If response is HTML (e.g. Cloudflare error page), don't include it
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        message = `${res.status}: ${res.statusText || "Server error"}`;
      } else {
        message = `${res.status}: ${text}`;
      }
    }
    throw new Error(message);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers: HeadersInit = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...options?.headers,
  };

  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  await throwIfResNotOk(res);
  return res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
