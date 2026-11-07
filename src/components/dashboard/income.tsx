"use client";

import { Button } from "@/components/arc/button/button";
import { LineChart } from "@/components/arc/line-chart/line-chart";
import { MONTHS_LONG, MONTHS_SHORT, dayMonth, parseISO } from "@/lib/dates";
import { INCOME_SOURCES, SOURCE_META } from "@/lib/constants";
import { incomeBySourceForMonth } from "@/lib/finance";
import { formatINR, formatTotalINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { Chip, EmptyState, Panel, SectionHeader } from "./primitives";

export function IncomeSection({ data }: { data: DashboardData }) {
  const openModal = useUI((s) => s.openModal);
  const legend = incomeBySourceForMonth(data);
  const total = legend.reduce((a, l) => a + l.amount, 0);
  const hist = data.history.incomeBySource;
  const hasHistory = hist.some((h) => INCOME_SOURCES.some((k) => h.bySource[k] > 0));

  return (
    <section aria-label="Income">
      <SectionHeader
        title="Income"
        right={
          <Button size="sm" variant="secondary" onClick={() => openModal("Income")}>
            <i className="ri-add-line text-[16px]" aria-hidden />
            Add income
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="min-w-0">
          <div className="text-[13px] text-(--p-fg2)">Received in {MONTHS_LONG[parseISO(data.month).m - 1]}</div>
          <div className="mt-1 font-display text-[clamp(28px,3cqw,36px)] tracking-[-.03em]">{formatTotalINR(total)}</div>
          <div className="mt-3 mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-(--p-fg2)">
            {legend.map((l) => (
              <span key={l.source} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: SOURCE_META[l.source].color }} />
                {l.source} <span className="font-medium text-(--p-ink)">{formatINR(l.amount)}</span>
              </span>
            ))}
          </div>
          {hasHistory ? (
            <LineChart
              label="Income by source, last 6 months"
              series={INCOME_SOURCES.map((k) => ({ key: k, label: k, color: SOURCE_META[k].color, area: false }))}
              data={hist.map((h) => {
                const p = parseISO(h.month);
                return {
                  key: h.month,
                  label: `${MONTHS_SHORT[p.m - 1]} ${p.y}`,
                  axisLabel: MONTHS_SHORT[p.m - 1],
                  values: Object.fromEntries(INCOME_SOURCES.map((k) => [k, h.bySource[k] / 100])),
                };
              })}
              legend={false}
              height={200}
              formatValue={(v) => formatINR(Math.round(v * 100))}
              formatTick={(v) => `₹${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v)}`}
              categoryLabel="Month"
            />
          ) : (
            <EmptyState scene="inbox" compact title="No income yet">
              Add your salary or freelance payments to see the trend.
            </EmptyState>
          )}
        </Panel>

        <Panel className="min-w-0">
          <h3 className="mb-2 text-sm font-medium">Recent income</h3>
          {data.recentIncome.length === 0 && (
            <EmptyState scene="inbox" compact title="Nothing received yet" />
          )}
          <ul>
            {data.recentIncome.map((r) => (
              <li key={r.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-(--p-line) py-3 last:border-0">
                <span className="text-xs text-(--p-fg3)">{dayMonth(r.date)}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm">{r.note || r.source}</div>
                  <Chip color={SOURCE_META[r.source].color} className="mt-1">
                    {r.source}
                  </Chip>
                </div>
                <span className="font-medium text-(--p-pos)">+{formatINR(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  );
}
