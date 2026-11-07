"use client";

import { useState } from "react";
import { DonutChart } from "@/components/arc/donut-chart/donut-chart";
import { formatCompactINR, formatRoundINR } from "@/lib/money";

export type DonutSlice = {
  key: string;
  label: string;
  amount: number;
  color: string;
};

/** Donut with a compact centre and a full-width legend underneath (fits narrow side panels). */
export function CategoryDonut({
  slices,
  label,
  totalLabel,
}: {
  slices: DonutSlice[];
  label: string;
  totalLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sorted = [...slices].sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((a, s) => a + s.amount, 0);
  return (
    <div className="flex flex-col gap-4">
      <DonutChart
        data={sorted.map((s) => ({
          key: s.key,
          label: s.label,
          value: s.amount / 100,
          color: s.color,
        }))}
        label={label}
        formatValue={(v) => formatCompactINR(Math.round(v * 100))}
        totalLabel={totalLabel}
        size={184}
        thickness={20}
        maxSegments={8}
        legend={false}
        activeKey={active}
        onActiveChange={setActive}
      />
      <ul className="w-full">
        {sorted.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            className="grid grid-cols-[10px_minmax(0,1fr)_auto_40px] items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] transition-colors hover:bg-(--p-surface2)"
          >
            <span
              className="size-2 rounded-full"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="truncate">{s.label}</span>
            <span className="font-medium tabular-nums">
              {formatRoundINR(s.amount)}
            </span>
            <span className="text-right text-xs text-(--p-fg3) tabular-nums">
              {total ? Math.round((s.amount / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
