"use client";

import Image from "next/image";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { ArcProvider } from "@/components/arc/lib/arc-provider";
import { ToastStack, ToastStackProvider } from "@/components/arc/toast-stack/toast-stack";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
        },
      }),
  );
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem disableTransitionOnChange>
      <ArcProvider link={Link} image={Image}>
        <QueryClientProvider client={queryClient}>
          <ToastStackProvider duration={5000}>
            {children}
            <ToastStack position="bottom-center" />
          </ToastStackProvider>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </QueryClientProvider>
      </ArcProvider>
    </ThemeProvider>
  );
}
