"use client";

import { useUI } from "@/stores/ui";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useToastStack } from "@/components/arc/toast-stack/toast-stack";
import { undo, type ActionResult } from "@/server/actions";
import type { DashboardData, LedgerData, RemindersData } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number) {
    super(`Request failed (${status})`);
  }
}

export const dashboardKey = (month: string | null) =>
  ["dashboard", month ?? "current"] as const;

export function useDashboard(month: string | null) {
  return useQuery({
    queryKey: dashboardKey(month),
    queryFn: async ({ signal }): Promise<DashboardData> => {
      const qs = month ? `?month=${encodeURIComponent(month)}` : "";
      const res = await fetch(`/api/dashboard${qs}`, {
        signal,
        cache: "no-store",
      });
      if (!res.ok) throw new HttpError(res.status);
      return res.json();
    },
    placeholderData: keepPreviousData,
    retry: (count, err) =>
      !(err instanceof HttpError && err.status === 401) && count < 1,
  });
}

/** Toasts from anywhere in the app (uiarc toast stack). */
export function useToast() {
  const { toast } = useToastStack();
  return {
    success: (title: string, description?: string) =>
      toast({ type: "success", title, description }),
    error: (title: string, description?: string) =>
      toast({ type: "error", title, description }),
    info: (
      title: string,
      opts: {
        description?: string;
        action?: { label: string; onClick: () => void };
        duration?: number;
      } = {},
    ) =>
      toast({
        type: "info",
        title,
        description: opts.description,
        action: opts.action,
        duration: opts.duration,
      }),
  };
}

/** How long the Undo button is offered; the server refuses undo tokens after the same window. */
export const UNDO_MS = 5_000;

type Message = string | { title: string; description?: string };

/**
 * Runs a server action, shows its error as a toast, and refreshes the dashboard on success.
 * The server is the source of truth for every number.
 *
 * Every write returns an undo token: the success toast then carries an Undo button for 5 s. After
 * that the token expires on the server and the change is permanent. `success` names what happened
 * (a string, or built from the result and input).
 */
export function useAction<I, O>(
  fn: (input: I) => Promise<ActionResult<O>>,
  opts: { success?: Message | ((data: O, input: I) => Message) } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();

  const runUndo = async (token: string, deadline: number) => {
    // The toast pauses while hovered; the offer itself doesn't.
    if (Date.now() > deadline)
      return toast.error("Too late to undo", "That change is saved.");
    const res = await undo({ token });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    if (res.ok) toast.success("Undone");
    else toast.error(res.error);
  };

  return useMutation({
    mutationFn: async (input: I) => {
      const res = await fn(input);
      if (!res.ok) throw new Error(res.error);
      const raw =
        typeof opts.success === "function"
          ? opts.success(res.data, input)
          : opts.success;
      const msg = typeof raw === "string" ? { title: raw } : raw;
      if (res.undo) {
        const token = res.undo;
        const deadline = Date.now() + UNDO_MS;
        toast.info(msg?.title ?? "Saved", {
          description: msg?.description,
          duration: UNDO_MS,
          action: {
            label: "Undo",
            onClick: () => void runUndo(token, deadline),
          },
        });
      } else if (msg) toast.success(msg.title, msg.description);
      return res.data;
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Something went wrong"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

/** Spends + income in a date range. Keyed under "dashboard" so every mutation refreshes it too. */
export function useLedger(from: string, to: string) {
  return useQuery({
    queryKey: ["dashboard", "ledger", from, to] as const,
    queryFn: async ({ signal }): Promise<LedgerData> => {
      const res = await fetch(
        `/api/ledger?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { signal, cache: "no-store" },
      );
      if (!res.ok) throw new HttpError(res.status);
      return res.json();
    },
    placeholderData: keepPreviousData,
    retry: (count, err) =>
      !(err instanceof HttpError && err.status === 401) && count < 1,
  });
}

export function useReminders(from: string, to: string) {
  return useQuery({
    queryKey: ["dashboard", "reminders", from, to] as const,
    queryFn: async ({ signal }): Promise<RemindersData> => {
      const res = await fetch(
        `/api/reminders?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { signal, cache: "no-store" },
      );
      if (!res.ok) throw new HttpError(res.status);
      return res.json();
    },
    placeholderData: keepPreviousData,
    retry: (count, err) =>
      !(err instanceof HttpError && err.status === 401) && count < 1,
  });
}

/**
 * Forget everything cached for the previous account. Query keys aren't scoped by user,
 * so without this a client-side sign-out → sign-in showed the old account until reload.
 */
export function useResetSession() {
  const qc = useQueryClient();
  return () => {
    qc.cancelQueries();
    qc.clear();
    useUI.getState().reset();
  };
}
