"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { MoneyInput } from "@/components/arc/money-input/money-input";
import { createGoal } from "@/server/actions";
import { useAction } from "@/hooks/use-dashboard";
import { MAX_PAISE } from "@/lib/money";
import { useUI } from "@/stores/ui";

export function GoalDialog() {
  const open = useUI((s) => s.goalDialogOpen);
  const setOpen = useUI((s) => s.setGoalDialogOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        title="New goal"
        description="Money you assign is earmarked, not moved. It comes off your free balance."
      >
        {open && <GoalForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [monthly, setMonthly] = useState<number | null>(null);
  const create = useAction(createGoal, { success: "Goal added" });
  const tooBig = target != null && monthly != null && monthly > target;
  const ready = name.trim() && target && monthly && !tooBig;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        create.mutate(
          { name: name.trim(), target: target!, monthly: monthly! },
          { onSuccess: onDone },
        );
      }}
      className="flex flex-col gap-4"
    >
      <Input
        label="What are you saving for?"
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. MacBook Air"
      />
      <MoneyInput
        label="Price"
        currency="INR"
        currencies={["INR"]}
        locale="en-IN"
        quickAdd={[]}
        value={target}
        onValueChange={setTarget}
        max={MAX_PAISE}
      />
      <MoneyInput
        label="Set aside per month"
        currency="INR"
        currencies={["INR"]}
        locale="en-IN"
        quickAdd={[]}
        value={monthly}
        onValueChange={setMonthly}
        max={MAX_PAISE}
        error={
          tooBig ? "Monthly amount can't be more than the price" : undefined
        }
      />
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready} loading={create.isPending}>
          Add goal
        </Button>
      </div>
    </form>
  );
}
