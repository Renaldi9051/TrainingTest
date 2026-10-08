"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/admin/ui/sonner";
import { TooltipProvider } from "@/components/admin/ui/tooltip";
import { ApiError } from "@/lib/api/client";

export function AdminProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Error 4xx (sesi habis, tidak ditemukan) tidak perlu diulang.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
