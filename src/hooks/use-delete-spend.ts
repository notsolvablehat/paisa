"use client";

import { deleteSpend } from "@/server/actions";
import { useAction } from "./use-dashboard";

/** Delete a spend; the toast's Undo (5 s) restores the exact row, bill link included. */
export function useDeleteSpend() {
  const del = useAction(deleteSpend, {
    success: (row) => ({
      title: "Spend deleted",
      description: row.billId
        ? "The linked bill is marked unpaid again."
        : undefined,
    }),
  });
  return (id: string) => del.mutate({ id });
}
