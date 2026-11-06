"use client";

import { useMemo } from "react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { setBillPaid } from "@/server/actions";
import { useAction } from "@/hooks/use-dashboard";
import { dayMonth } from "@/lib/dates";
import { billRows, billsSummary, relativeDue } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { EmptyState, Panel, SectionHeader } from "./primitives";

export function Bills({ data }: { data: DashboardData }) {
  const rows = useMemo(() => billRows(data.bills, data.today), [data.bills, data.today]);
  const sum = billsSummary(rows);
  const toggle = useAction(setBillPaid);
  const openModal = useUI((s) => s.openModal);

  return (
    <section aria-label="Coming up" id="coming-up" className="scroll-mt-24">
      <SectionHeader
        title="Coming up"
        right={
          <Button size="sm" variant="secondary" onClick={() => openModal("Reminder")}>
            <i className="ri-add-line text-[16px]" aria-hidden />
            Add reminder
          </Button>
        }
      />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState scene="inbox" title="Nothing coming up">
            Add rent, subscriptions or insurance as reminders and they&apos;ll count against today&apos;s safe-to-spend.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-[15px] text-(--p-fg2)">
              <span className="font-medium text-(--p-ink)">{formatINR(sum.next14)}</span> due in the next 14 days.
              {sum.overdue.length > 0 && (
                <span className="text-(--p-warn)">
                  {" "}
                  {sum.overdue.map((b) => b.name).join(", ")} slipped past {sum.overdue.length === 1 ? "its" : "their"} date — no rush, just
                  tick {sum.overdue.length === 1 ? "it" : "them"} off when done.
                </span>
              )}
            </p>
            <ul className="relative">
              {rows.map((b) => {
                const muted = b.paid ? "text-(--p-fg3) line-through" : "text-(--p-ink)";
                const busy = toggle.isPending && toggle.variables?.billId === b.id;
                return (
                  <li
                    key={b.id}
                    className="grid min-h-[60px] grid-cols-[clamp(64px,9cqw,104px)_16px_minmax(0,1fr)_auto_44px] items-center gap-x-4"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={cn("text-[13px] font-medium", b.paid ? "text-(--p-fg3)" : "text-(--p-ink)")}>{dayMonth(b.dueOn)}</span>
                      <span className={cn("text-xs", b.overdue ? "text-(--p-warn)" : "text-(--p-fg3)")}>{relativeDue(b)}</span>
                    </div>
                    <div className="relative grid place-items-center self-stretch" aria-hidden>
                      <div className="absolute inset-y-0 left-1/2 w-px bg-(--p-line)" />
                      <div
                        className="relative size-[9px] rounded-full shadow-[0_0_0_3px_var(--p-surface)]"
                        style={{ background: b.paid ? "var(--p-pos)" : b.overdue ? "var(--p-accent)" : "var(--p-lineStrong)" }}
                      />
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-(--p-line) py-3">
                      <span className={cn("text-sm", muted)}>{b.name}</span>
                      <Badge size="sm" pill outline>
                        {b.recurrence}
                      </Badge>
                    </div>
                    <span className={cn("flex items-center self-stretch border-b border-(--p-line) font-medium", muted)}>
                      {formatINR(b.amount)}
                    </span>
                    <div className="flex items-center justify-end self-stretch border-b border-(--p-line)">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={b.paid}
                        aria-label={`Mark ${b.name} ${b.paid ? "unpaid" : "paid"}`}
                        title={b.paid ? "Mark unpaid" : "Mark paid"}
                        disabled={busy}
                        onClick={() => toggle.mutate({ billId: b.id, paid: !b.paid })}
                        className="grid size-11 place-items-center p-0"
                      >
                        <span
                          className={cn(
                            "grid size-[22px] place-items-center rounded-[7px] border transition-colors",
                            b.paid ? "border-(--p-primary) bg-(--p-primary) text-(--p-onPrimary)" : "border-(--p-lineStrong) bg-transparent",
                            busy && "opacity-50",
                          )}
                        >
                          {b.paid && <i className="ri-check-line text-[14px]" aria-hidden />}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </section>
  );
}
