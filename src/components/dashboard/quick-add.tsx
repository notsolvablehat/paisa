"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { MoneyInput } from "@/components/arc/money-input/money-input";
import { MorphSelect } from "@/components/arc/morph-select/morph-select";
import {
  addBill,
  addIncome,
  addSpend,
  contributeToGoal,
  createCategory,
  updateSpend,
} from "@/server/actions";
import { useAction, useToast } from "@/hooks/use-dashboard";
import {
  CUSTOM_COLORS,
  CUSTOM_ICONS,
  INCOME_SOURCES,
  RECURRENCES,
  SOURCE_META,
  type IncomeSource,
  type Recurrence,
} from "@/lib/constants";
import { addDays, parseISO, toISO } from "@/lib/dates";
import { formatINR, MAX_PAISE } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUI, type Mode } from "@/stores/ui";
import { Segmented } from "./primitives";

const MODES = ["Spend", "Income", "Goal contribution", "Reminder"] as const satisfies readonly Mode[];
const MODE_LABELS: Record<Mode, string> = { Spend: "Spend", Income: "Income", "Goal contribution": "Goal", Reminder: "Reminder" };

/** ISO "2026-11-07" ⇄ local Date at midnight (no timezone drift). */
const isoToDate = (iso: string) => {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m - 1, d);
};
const dateToIso = (dt: Date) => toISO({ y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() });

export function QuickAdd({ data }: { data: DashboardData }) {
  const modal = useUI((s) => s.modal);
  const closeModal = useUI((s) => s.closeModal);
  const editing = Boolean(modal.prefill.editTxId);

  return (
    <Dialog open={modal.open} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        title={editing ? "Edit spend" : "Quick add"}
        description={editing ? undefined : "Ctrl K opens this from anywhere."}
        className="w-[min(calc(100vw-32px),560px)]!"
        // The form focuses the amount itself; skip Radix's "first focusable" default.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <QuickAddForm key={modal.nonce} data={data} />
      </DialogContent>
    </Dialog>
  );
}

function QuickAddForm({ data }: { data: DashboardData }) {
  const { mode: initialMode, prefill } = useUI((s) => s.modal);
  const closeModal = useUI((s) => s.closeModal);
  const toast = useToast();
  const editing = Boolean(prefill.editTxId);

  const openGoals = data.goals.filter((g) => g.assigned < g.target);
  const defaultCat = prefill.categoryId ?? data.categories.find((c) => c.name === "Food")?.id ?? data.categories[0]?.id ?? "";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [amount, setAmount] = useState<number | null>(prefill.amount ?? null);
  const [note, setNote] = useState(prefill.note ?? "");
  const [cat, setCat] = useState(defaultCat);
  const [source, setSource] = useState<IncomeSource>("Salary");
  const [goalId, setGoalId] = useState(prefill.goalId ?? openGoals[0]?.id ?? "");
  const [remName, setRemName] = useState("");
  const [remRec, setRemRec] = useState<Recurrence>("Monthly");
  const [custom, setCustom] = useState(false);
  const [cName, setCName] = useState("");
  const [cIcon, setCIcon] = useState<(typeof CUSTOM_ICONS)[number]>(CUSTOM_ICONS[0]);
  const [cColor, setCColor] = useState<(typeof CUSTOM_COLORS)[number]>(CUSTOM_COLORS[0]);
  const [date, setDate] = useState<string | null>(prefill.date ?? null);
  const [error, setError] = useState<string | undefined>();
  const amountRef = useRef<HTMLInputElement>(null);

  // Typing should go straight into the amount, like a command palette.
  useEffect(() => {
    const id = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const effectiveDate = date ?? (mode === "Reminder" ? addDays(data.today, 7) : data.today);

  const spend = useAction(addSpend, { success: "Spend added" });
  const edit = useAction(updateSpend, { success: "Changes saved" });
  const inc = useAction(addIncome, { success: "Income added" });
  const contrib = useAction(contributeToGoal);
  const bill = useAction(addBill, { success: "Reminder added" });
  const newCat = useAction(createCategory, { success: "Category created" });
  const pending = spend.isPending || edit.isPending || inc.isPending || contrib.isPending || bill.isPending;

  const categoryItems = useMemo(
    () =>
      data.categories.map((c) => ({
        value: c.id,
        label: c.name,
        icon: <i className={c.icon} style={{ color: c.color }} aria-hidden />,
      })),
    [data.categories],
  );

  async function save() {
    if (pending) return;
    setError(undefined);
    if (!amount || amount <= 0) return setError("Enter an amount");
    const n = note.trim();
    if (mode === "Spend") {
      if (!cat) return setError("Pick a category");
      const input = { amount, categoryId: cat, note: n, date: effectiveDate };
      if (editing) await edit.mutateAsync({ ...input, id: prefill.editTxId! });
      else await spend.mutateAsync(input);
    } else if (mode === "Income") {
      await inc.mutateAsync({ amount, source, note: n, date: effectiveDate });
    } else if (mode === "Goal contribution") {
      if (!goalId) return setError("Create a goal first");
      const r = await contrib.mutateAsync({ goalId, amount, note: n, date: effectiveDate });
      toast.success(r.capped ? `Only ${formatINR(r.applied)} was needed — goal fully funded` : "Assigned to goal");
    } else {
      const name = remName.trim() || n;
      if (!name) return setError("What is the reminder for?");
      await bill.mutateAsync({ name, amount, dueOn: effectiveDate, recurrence: remRec });
    }
    closeModal();
  }

  const saveLabel =
    mode === "Spend" ? (editing ? "Save changes" : "Add spend") : mode === "Income" ? "Add income" : mode === "Goal contribution" ? "Assign to goal" : "Add reminder";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save().catch(() => {}); // errors are already toasted
      }}
    >
      {!editing && (
        <Segmented<Mode>
          ariaLabel="What are you adding"
          options={MODES}
          labels={MODE_LABELS}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setCustom(false);
            setError(undefined);
          }}
        />
      )}

      <MoneyInput
        ref={amountRef}
        label="Amount"
        currency="INR"
        currencies={["INR"]}
        locale="en-IN"
        value={amount}
        onValueChange={(v) => {
          setAmount(v);
          setError(undefined);
        }}
        max={MAX_PAISE}
        quickAdd={mode === "Reminder" ? [] : [100, 500, 1000]}
        error={error}
      />

      {mode === "Spend" && (
        <div className="flex flex-col gap-2">
          <MorphSelect
            label="Category"
            items={categoryItems}
            value={cat}
            onValueChange={(v) => setCat(v)}
            searchable
            searchPlaceholder="Search categories"
          />
          <button
            type="button"
            onClick={() => setCustom(!custom)}
            aria-expanded={custom}
            className="self-start text-[13px] font-medium text-(--p-accent) hover:underline"
          >
            {custom ? "Cancel new category" : "+ Create a custom category"}
          </button>
          {custom && (
            <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-(--p-line) bg-(--p-surface2) p-3.5">
              <Input label="Category name" value={cName} maxLength={40} onChange={(e) => setCName(e.target.value)} />
              <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Icon">
                {CUSTOM_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-label={i.replace(/^ri-|-line$/g, "")}
                    aria-checked={cIcon === i}
                    onClick={() => setCIcon(i)}
                    className={cn(
                      "grid size-9 place-items-center rounded-full border bg-(--p-surface)",
                      cIcon === i ? "border-(--p-ink)" : "border-(--p-line)",
                    )}
                  >
                    <i className={cn(i, "text-[16px]")} style={{ color: cColor }} aria-hidden />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour">
                {CUSTOM_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    role="radio"
                    aria-label={`Colour ${col}`}
                    aria-checked={cColor === col}
                    onClick={() => setCColor(col)}
                    className="size-6 rounded-full"
                    style={{ background: col, boxShadow: cColor === col ? `0 0 0 2px var(--p-surface2), 0 0 0 4px ${col}` : "none" }}
                  />
                ))}
                <div className="ml-auto">
                  <ActionButton
                    type="button"
                    label="Create category"
                    pendingLabel="Creating"
                    successLabel="Created"
                    disabled={!cName.trim()}
                    onAction={async () => {
                      const id = await newCat.mutateAsync({ name: cName.trim(), icon: cIcon, color: cColor });
                      setCat(id);
                      setCName("");
                      setTimeout(() => setCustom(false), 900);
                    }}
                    onActionError={() => {}}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "Income" && (
        <MorphSelect
          label="Source"
          items={INCOME_SOURCES.map((k) => ({
            value: k,
            label: k,
            icon: <i className={SOURCE_META[k].icon} style={{ color: SOURCE_META[k].color }} aria-hidden />,
          }))}
          value={source}
          onValueChange={(v) => setSource(v as IncomeSource)}
          searchable={false}
        />
      )}

      {mode === "Goal contribution" &&
        (openGoals.length === 0 ? (
          <p className="text-[13px] text-(--p-fg3)">No open goals. Create one under Wishlist.</p>
        ) : (
          <MorphSelect
            label="Goal"
            items={openGoals.map((g) => ({
              value: g.id,
              label: g.name,
              meta: `${formatINR(g.target - g.assigned)} to go`,
              icon: <i className="ri-flag-2-line" aria-hidden />,
            }))}
            value={goalId}
            onValueChange={(v) => setGoalId(v)}
          />
        ))}

      {mode === "Reminder" && (
        <div className="flex flex-col gap-3">
          <Input
            label="What is it?"
            placeholder="e.g. Car insurance"
            value={remName}
            maxLength={80}
            onChange={(e) => setRemName(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Repeats</span>
            <Segmented<Recurrence> ariaLabel="Repeats" options={RECURRENCES} value={remRec} onChange={setRemRec} />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
        <DatePicker
          type="button"
          label={mode === "Reminder" ? "Due date" : "Date"}
          value={isoToDate(effectiveDate)}
          onChange={(d) => d && setDate(dateToIso(d))}
          minDate={mode === "Reminder" ? isoToDate(data.today) : undefined}
          maxDate={mode === "Reminder" ? undefined : isoToDate(data.today)}
          locale="en-IN"
          format={{ day: "numeric", month: "short", year: "numeric" }}
        />
        <Input label="Note" placeholder="Optional" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-(--p-line) pt-4">
        <span className="mr-auto text-xs text-(--p-fg3) max-sm:hidden">Enter to save</span>
        <Button type="button" variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
