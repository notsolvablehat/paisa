"use client";

import { updateBudget } from "@/server/actions";
import { useAction } from "@/hooks/use-dashboard";
import type { Summary } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { AmountEdit, Panel, ProgressBar, SectionHeader } from "./primitives";

export function Budgets({ data, s }: { data: DashboardData; s: Summary }) {
  const save = useAction(updateBudget, { success: "Budget updated" });
  const B = data.settings;
  const hardScale = Math.max(B.hardLimit, B.monthlyBudget, s.spent, 1) * 1.12;

  const edit = (key: "monthly" | "daily" | "hard", value: number, label: string) => (
    <AmountEdit value={value} label={label} variant="title" onSave={(amount) => save.mutateAsync({ key, amount })} />
  );

  return (
    <section aria-label="Budgets">
      <SectionHeader title="Budgets" right={<span className="text-[13px] text-(--p-fg3)">Click an amount to edit</span>} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
        <Panel className="flex flex-col gap-3.5">
          <span className="text-[13px] text-(--p-fg2)">Monthly budget</span>
          <div className="font-display text-[32px] tracking-[-.03em]">{edit("monthly", B.monthlyBudget, "Monthly budget")}</div>
          <ProgressBar pct={s.usedPct} />
          <div className="text-xs text-(--p-fg3)">
            {formatINR(s.spent)} spent · {formatINR(Math.max(0, s.budgetLeft))} left
            {s.budgetLeft < 0 && <span className="text-(--p-warn)"> · {formatINR(-s.budgetLeft)} over</span>}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3.5">
          <span className="text-[13px] text-(--p-fg2)">Daily budget</span>
          <div className="font-display text-[32px] tracking-[-.03em]">{edit("daily", B.dailyBudget, "Daily budget")}</div>
          <ProgressBar pct={B.dailyBudget > 0 ? (s.todaySpent / B.dailyBudget) * 100 : 0} />
          <div className="text-xs text-(--p-fg3)">
            {s.phase === "current" ? `${formatINR(s.todaySpent)} spent today · ` : ""}averaging {formatINR(Math.round(s.avgDaily))} a day
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3.5 border-(--p-ink)">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-(--p-ink)">
            <i className="ri-lock-line text-[14px]" aria-hidden />
            Hard limit
          </span>
          <div className="font-display text-[32px] font-medium tracking-[-.03em]">{edit("hard", B.hardLimit, "Hard limit")}</div>
          <div className="relative h-1.5 rounded-full bg-(--p-track)">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-(--p-ink) transition-[width] duration-500"
              style={{ width: `${Math.min(100, (s.spent / hardScale) * 100)}%` }}
            />
            <div
              title="Monthly budget"
              className="absolute -inset-y-[3px] w-px bg-(--p-lineStrong)"
              style={{ left: `${Math.min(100, (B.monthlyBudget / hardScale) * 100)}%` }}
            />
            <div className="absolute -inset-y-2 -ml-px w-[3px] rounded-full bg-(--p-accent)" style={{ left: `${(B.hardLimit / hardScale) * 100}%` }} />
          </div>
          <div className="text-xs text-(--p-fg3)">
            {formatINR(Math.max(0, B.hardLimit - s.spent))} of room before the line · budget mark at {formatINR(B.monthlyBudget)}
          </div>
        </Panel>
      </div>
    </section>
  );
}
