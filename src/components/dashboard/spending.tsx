"use client";

import { useMemo, useState } from "react";
import { BarChart } from "@/components/arc/bar-chart/bar-chart";
import { Button } from "@/components/arc/button/button";
import { LineChart, type LineChartSeries } from "@/components/arc/line-chart/line-chart";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { deleteSpend, restoreSpend, updateCategoryBudget } from "@/server/actions";
import { useAction, useToast } from "@/hooks/use-dashboard";
import { dayMonth, monthLabel } from "@/lib/dates";
import { buildChart, categoryRows, type Range, type Summary } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { AmountEdit, Chip, EmptyState, Panel, SectionHeader, Segmented } from "./primitives";

/** Charts take rupees; the app stores paise. */
const R = (paise: number) => paise / 100;
const fmtR = (rupees: number) => formatINR(Math.round(rupees * 100));

export function Spending({ data, s }: { data: DashboardData; s: Summary }) {
  return (
    <section aria-label="Spending">
      <SectionHeader
        title="Spending"
        right={
          <span className="text-[13px] text-(--p-fg3)">
            {formatINR(s.spent)} of {formatINR(data.settings.monthlyBudget)}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SpendChart data={data} s={s} />
        <CategoryList data={data} />
      </div>
      <Transactions data={data} />
    </section>
  );
}

/* ───────────────────────────── chart ───────────────────────────── */

const SERIES_MONTH: LineChartSeries[] = [
  { key: "spent", label: "Spent", color: "var(--p-ink)", area: true },
  { key: "income", label: "Income", color: "var(--p-pos)", area: false },
  { key: "budget", label: "Budget", color: "var(--p-accent)", dashed: true, area: false },
];

function SpendChart({ data, s }: { data: DashboardData; s: Summary }) {
  const range = useUI((st) => st.range);
  const setRange = useUI((st) => st.setRange);
  const c = useMemo(() => buildChart(range, data, s, formatINR), [range, data, s]);
  const shown = c.bars.filter((b) => !b.future);
  const period = range === "year" ? `${data.history.years[0].year}–${data.history.years[2].year}` : range === "month" ? c.caption.replace(/^Spent /, "") : monthLabel(data.month);

  return (
    <Panel className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-(--p-fg2)">{c.caption}</div>
        <Segmented<Range>
          ariaLabel="Chart range"
          options={["day", "week", "month", "year"]}
          labels={{ day: "Day", week: "Week", month: "Month", year: "Year" }}
          value={range}
          onChange={setRange}
        />
      </div>

      {range === "day" || range === "week" ? (
        shown.every((b) => b.value === 0) ? (
          <EmptyState scene="inbox" compact title="Nothing to chart yet">
            {shown.length === 0 ? "This month hasn't started." : "Your daily spending will show up here."}
          </EmptyState>
        ) : (
          <BarChart
            label={c.caption}
            period={period}
            data={shown.map((b) => ({ key: b.title, label: b.title, axisLabel: b.label || undefined, value: R(b.value) }))}
            averageLabel={range === "day" ? "Daily average" : "Weekly average"}
            valueLabel="Spent"
            categoryLabel={range === "day" ? "Day" : "Week"}
            height={220}
            formatValue={fmtR}
          />
        )
      ) : (
        <>
          <div className="mb-2">
            <div className="font-display text-[clamp(28px,3cqw,36px)] tracking-[-.03em]">{formatINR(c.total)}</div>
            <div className="text-xs text-(--p-fg3)">{period}</div>
          </div>
          <LineChart
            label={c.caption}
            series={range === "month" ? SERIES_MONTH : SERIES_MONTH.slice(0, 2)}
            data={c.bars.map((b) => ({
              key: b.title,
              label: b.title,
              axisLabel: b.label,
              values: { spent: R(b.value), income: R(b.income), ...(c.budgetLine != null ? { budget: R(c.budgetLine) } : {}) },
            }))}
            height={240}
            formatValue={(v) => fmtR(v)}
            formatTick={(v) => `₹${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)}`}
            categoryLabel={range === "month" ? "Month" : "Year"}
          />
        </>
      )}
      {range === "day" && data.settings.dailyBudget > 0 && (
        <p className="mt-3 text-xs text-(--p-fg3)">
          Daily budget {formatINR(data.settings.dailyBudget)} ·{" "}
          {c.bars.filter((b) => b.over).length > 0 ? (
            <span className="text-(--p-warn)">{c.bars.filter((b) => b.over).length} day(s) over</span>
          ) : (
            "no days over"
          )}
        </p>
      )}
    </Panel>
  );
}

/* ───────────────────────────── categories ───────────────────────────── */

function CategoryList({ data }: { data: DashboardData }) {
  const rows = useMemo(() => categoryRows(data.categories, data.transactions), [data]);
  const save = useAction(updateCategoryBudget, { success: "Budget updated" });

  return (
    <Panel className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">By category</h3>
        <span className="text-xs text-(--p-fg3)">Click a budget to edit</span>
      </div>
      {rows.length === 0 && (
        <EmptyState scene="search" compact title="No category spending yet">
          Spends you add will be grouped here.
        </EmptyState>
      )}
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn(
              "-mx-3 grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-[14px] px-3 py-2.5",
              r.over && "bg-(--p-overTint)",
            )}
          >
            <span className="grid size-7 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${r.color} 14%, transparent)` }}>
              <i className={cn(r.icon, "text-[15px]")} style={{ color: r.color }} aria-hidden />
            </span>
            <span className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="truncate">{r.name}</span>
              {r.over && <span className="text-xs whitespace-nowrap text-(--p-warn)">{formatINR(r.spent - r.budget)} over</span>}
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="font-medium">{formatINR(r.spent)}</span>
              <span className="text-xs text-(--p-fg3)">of</span>
              <span className="text-xs text-(--p-fg3)">
                <AmountEdit
                  value={r.budget}
                  label={`${r.name} budget`}
                  emptyText="Set budget"
                  onSave={(amount) => save.mutateAsync({ categoryId: r.id, amount })}
                />
              </span>
            </span>
            <div className="col-[2/4] h-1 overflow-hidden rounded-full bg-(--p-track)">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${r.pct}%`, background: r.over ? "var(--p-accent)" : r.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ───────────────────────────── transactions ───────────────────────────── */

function Transactions({ data }: { data: DashboardData }) {
  const [showAll, setShowAll] = useState(false);
  const openModal = useUI((s) => s.openModal);
  const toast = useToast();
  const del = useAction(deleteSpend);
  const restore = useAction(restoreSpend, { success: "Restored" });
  const catBy = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const list = showAll ? data.transactions : data.transactions.slice(0, 7);

  const onDelete = (id: string) =>
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

  return (
    <Panel className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{showAll ? "All transactions" : "Recent transactions"}</h3>
        <span className="text-xs text-(--p-fg3)">{data.transactions.length} this month</span>
      </div>
      {list.length === 0 && (
        <EmptyState
          scene="inbox"
          title="No spends this month yet"
          action={
            <Button size="sm" variant="secondary" onClick={() => openModal("Spend")}>
              Add a spend
            </Button>
          }
        >
          Press Ctrl K anywhere to add one.
        </EmptyState>
      )}
      <ul>
        {list.map((t) => {
          const c = catBy.get(t.categoryId);
          return (
            <li
              key={t.id}
              className="group -mx-3 grid grid-cols-[56px_minmax(0,1fr)_auto_68px] items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors focus-within:bg-(--p-surface2) hover:bg-(--p-surface2)"
            >
              <span className="text-xs text-(--p-fg3)">{dayMonth(t.date)}</span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Chip color={c?.color ?? "#8E8E97"}>{c?.name ?? "Unknown"}</Chip>
                <span className="min-w-0 truncate text-sm">{t.note || c?.name}</span>
              </div>
              <span className="text-right font-medium">{formatINR(t.amount)}</span>
              <div className="flex justify-end gap-0.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <Tooltip content="Edit">
                  <button
                    type="button"
                    aria-label={`Edit ${t.note || "spend"}`}
                    onClick={() =>
                      openModal("Spend", { editTxId: t.id, amount: t.amount, categoryId: t.categoryId, note: t.note, date: t.date })
                    }
                    className="grid size-8 place-items-center rounded-full text-(--p-fg3) hover:bg-(--p-surface) hover:text-(--p-ink)"
                  >
                    <i className="ri-pencil-line text-[15px]" aria-hidden />
                  </button>
                </Tooltip>
                <Tooltip content="Delete">
                  <button
                    type="button"
                    aria-label={`Delete ${t.note || "spend"}`}
                    onClick={() => onDelete(t.id)}
                    className="grid size-8 place-items-center rounded-full text-(--p-fg3) hover:bg-(--p-surface) hover:text-(--p-warn)"
                  >
                    <i className="ri-delete-bin-6-line text-[15px]" aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </li>
          );
        })}
      </ul>
      {data.transactions.length > 7 && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer" : `Show all ${data.transactions.length}`}
          </Button>
        </div>
      )}
    </Panel>
  );
}
