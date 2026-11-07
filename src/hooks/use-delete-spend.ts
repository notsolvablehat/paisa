"use client";

import { deleteSpend, restoreSpend } from "@/server/actions";
import { useAction, useToast } from "./use-dashboard";

/** Delete a spend with an Undo toast (restores the exact row, bill link included). */
export function useDeleteSpend() {
  const toast = useToast();
  const del = useAction(deleteSpend);
  const restore = useAction(restoreSpend, { success: "Restored" });
  return (id: string) =>
    del.mutate(
      { id },
      {
        onSuccess: (row) =>
          toast.info("Spend deleted", {
            description: row.billId ? "The linked bill is marked unpaid again." : undefined,
            action: { label: "Undo", onClick: () => restore.mutate(row) },
          }),
      },
    );
}
