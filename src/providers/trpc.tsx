import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { nativeServerUrl, nativeSessionToken } from "@/lib/native";

const apiUrl = () => `${nativeServerUrl()}/api/trpc`;
const authHeaders = () => {
  const token = nativeSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        url: apiUrl(),
        transformer: superjson,
        eventSourceOptions: { withCredentials: true },
      }),
      false: httpBatchLink({
        url: apiUrl(),
        transformer: superjson,
        headers: authHeaders,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
