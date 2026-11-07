"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/arc/popover/popover";
import {
  MONTHS_LONG,
  MONTHS_SHORT,
  addMonths,
  monthKey,
  monthLabel,
  parseISO,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const iconBtn =
  "grid place-items-center rounded-full text-(--p-fg3) transition-colors hover:bg-(--p-surface2) hover:text-(--p-ink) disabled:opacity-30 disabled:hover:bg-transparent";

/**
 * ‹ November 2026 › — the label opens a year grid of months. Future months are
 * disabled; picking the current month returns to "live" (null).
 */
export function MonthPicker({
  month,
  current,
  onChange,
  short = false,
  loading = false,
}: {
  month: string;
  current: string;
  onChange: (month: string | null) => void;
  short?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => parseISO(month).y);
  const cur = parseISO(current);
  const sel = parseISO(month);
  const pick = (m: string) => {
    onChange(m === current ? null : m);
    setOpen(false);
  };
  const step = (n: number) => {
    const next = addMonths(month, n);
    if (next <= current) onChange(next === current ? null : next);
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => step(-1)}
        className={`${iconBtn} size-8`}
      >
        <i className="ri-arrow-left-s-line text-[20px]" aria-hidden />
      </button>

      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o) setYear(sel.y);
          setOpen(o);
        }}
      >
        <PopoverTrigger
          className={cn(
            "flex h-9 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium transition-colors hover:bg-(--p-surface2)",
            short ? "min-w-[96px]" : "min-w-[150px]",
            open && "bg-(--p-surface2)",
          )}
          aria-label={`Viewing ${monthLabel(month)}. Choose month`}
        >
          <span aria-live="polite" className="whitespace-nowrap">
            {monthLabel(month, short)}
            {loading && <span className="sr-only"> loading</span>}
          </span>
          <i
            className={cn(
              "ri-arrow-down-s-line text-[16px] text-(--p-fg3) transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[288px]! p-3!">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setYear(year - 1)}
              className={`${iconBtn} size-8`}
            >
              <i className="ri-arrow-left-s-line text-[18px]" aria-hidden />
            </button>
            <span className="text-sm font-medium tabular-nums">{year}</span>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setYear(year + 1)}
              disabled={year >= cur.y}
              className={`${iconBtn} size-8`}
            >
              <i className="ri-arrow-right-s-line text-[18px]" aria-hidden />
            </button>
          </div>
          <div
            role="group"
            aria-label={`Months of ${year}`}
            className="grid grid-cols-3 gap-1"
          >
            {MONTHS_SHORT.map((label, i) => {
              const key = monthKey(year, i + 1);
              const future = key > current;
              const selected = year === sel.y && i + 1 === sel.m;
              const isCurrent = key === current;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={future}
                  aria-pressed={selected}
                  aria-label={`${MONTHS_LONG[i]} ${year}`}
                  onClick={() => pick(key)}
                  className={cn(
                    "relative h-10 rounded-[12px] text-sm transition-colors",
                    selected
                      ? "bg-(--p-primary) font-medium text-(--p-onPrimary)"
                      : "text-(--p-ink) hover:bg-(--p-surface2) disabled:text-(--p-fg3) disabled:opacity-40 disabled:hover:bg-transparent",
                  )}
                >
                  {label}
                  {isCurrent && !selected && (
                    <span
                      className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-(--p-accent)"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
          {month !== current && (
            <button
              type="button"
              onClick={() => pick(current)}
              className="mt-2 h-9 w-full rounded-[12px] text-[13px] font-medium text-(--p-fg2) transition-colors hover:bg-(--p-surface2) hover:text-(--p-ink)"
            >
              Back to {MONTHS_LONG[cur.m - 1]}
            </button>
          )}
        </PopoverContent>
      </Popover>

      <button
        type="button"
        aria-label="Next month"
        onClick={() => step(1)}
        disabled={month >= current}
        className={`${iconBtn} size-8`}
      >
        <i className="ri-arrow-right-s-line text-[20px]" aria-hidden />
      </button>
    </div>
  );
}
