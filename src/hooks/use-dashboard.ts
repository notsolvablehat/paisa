"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToastStack } from "@/components/arc/toast-stack/toast-stack";
import type { ActionResult } from "@/server/actions";
import type { DashboardData } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number) {
    super(`Request failed (${status})`);
  }
}

export const dashboardKey = (month: string | null) => ["dashboard", month ?? "current"] as const;

export function useDashboard(month: string | null) {
  return useQuery({
    queryKey: dashboardKey(month),
    queryFn: async ({ signal }): Promise<DashboardData> => {
      const qs = month ? `?month=${encodeURIComponent(month)}` : "";
      const res = await fetch(`/api/dashboard${qs}`, { signal, cache: "no-store" });
      if (!res.ok) throw new HttpError(res.status);
      return res.json();
    },
    placeholderData: keepPreviousData,
    retry: (count, err) => !(err instanceof HttpError && err.status === 401) && count < 1,
  });
}

/** Toasts from anywhere in the app (uiarc toast stack). */
export function useToast() {
  const { toast } = useToastStack();
  return {
    success: (title: string, description?: string) => toast({ type: "success", title, description }),
    error: (title: string, description?: string) => toast({ type: "error", title, description }),
    info: (title: string, opts: { description?: string; action?: { label: string; onClick: () => void } } = {}) =>
      toast({ type: "info", title, description: opts.description, action: opts.action }),
  };
}

/**
 * Runs a server action, shows its error as a toast, and refreshes the
 * dashboard on success. The server is the source of truth for every number.
 */
export function useAction<I, O>(fn: (input: I) => Promise<ActionResult<O>>, opts: { success?: string } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (input: I) => {
      const res = await fn(input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      if (opts.success) toast.success(opts.success);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}
