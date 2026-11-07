"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { MoneyInput } from "@/components/arc/money-input/money-input";
import { MorphSelect } from "@/components/arc/morph-select/morph-select";
import { Segmented } from "@/components/dashboard/primitives";
import { useAction } from "@/hooks/use-dashboard";
import { RECURRENCES, type Recurrence } from "@/lib/constants";
import { isoToLocalDate, localDateToISO } from "@/lib/dates";
import { MAX_PAISE } from "@/lib/money";
import type { Category, ReminderRow } from "@/lib/types";
import { updateBill } from "@/server/actions";

/** Edit one unpaid reminder occurrence. */
export function ReminderDialog({
  reminder,
  categories,
  onClose,
}: {
  reminder: ReminderRow | null;
  categories: Category[];
  onClose: () => void;
}) {
  return (
    <Dialog open={reminder != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Edit reminder"
        description="Changes apply to this occurrence and the ones after it."
        className="w-[min(calc(100vw-32px),520px)]! [@media(min-height:720px)]:overflow-visible!"
      >
        {reminder && <ReminderForm key={reminder.id} reminder={reminder} categories={categories} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ReminderForm({ reminder, categories, onDone }: { reminder: ReminderRow; categories: Category[]; onDone: () => void }) {
  const [name, setName] = useState(reminder.name);
  const [amount, setAmount] = useState<number | null>(reminder.amount);
  const [dueOn, setDueOn] = useState(reminder.dueOn);
  const [recurrence, setRecurrence] = useState<Recurrence>(reminder.recurrence);
  const [categoryId, setCategoryId] = useState(reminder.categoryId);
  const save = useAction(updateBill, { success: "Reminder updated" });
  const ready = name.trim() && amount && amount > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || save.isPending) return;
        save.mutate({ billId: reminder.id, name: name.trim(), amount: amount!, dueOn, recurrence, categoryId }, { onSuccess: onDone });
      }}
    >
      <Input label="What is it?" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <MoneyInput label="Amount" currency="INR" currencies={["INR"]} locale="en-IN" quickAdd={[]} value={amount} onValueChange={setAmount} max={MAX_PAISE} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DatePicker
          type="button"
          label="Due date"
          value={isoToLocalDate(dueOn)}
          onChange={(d) => d && setDueOn(localDateToISO(d))}
          locale="en-IN"
          format={{ day: "numeric", month: "short", year: "numeric" }}
        />
        <MorphSelect
          label="Category"
          items={categories.map((c) => ({ value: c.id, label: c.name, icon: <i className={c.icon} style={{ color: c.color }} aria-hidden /> }))}
          value={categoryId}
          onValueChange={setCategoryId}
          searchable
          searchPlaceholder="Search categories"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Repeats</span>
        <Segmented<Recurrence> ariaLabel="Repeats" options={RECURRENCES} value={recurrence} onChange={setRecurrence} />
      </div>
      <div className="mt-1 flex justify-end gap-2 border-t border-(--p-line) pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready} loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
