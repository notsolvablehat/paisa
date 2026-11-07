"use client";

import { useMemo } from "react";
import { setBalance, updateBudget } from "@/server/actions";
import { useAction } from "@/hooks/use-dashboard";
import { longDay, monthLabel, MONTHS_LONG, parseISO } from "@/lib/dates";
import { budgetNotes, categoryRows, type Summary } from "@/lib/finance";
import { formatINR, formatTotalINR, NO_DATA, formatNumber } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { AmountEdit, Panel } from "./primitives";

const B = ({ children }: { children: React.ReactNode }) => (
  <span className="font-medium text-(--p-ink)">{children}</span>
);

export function Hero({ data, s }: { data: DashboardData; s: Summary }) {
  const saveBalance = useAction(setBalance, { success: "Balance updated" });
  const saveBudget = useAction(updateBudget, { success: "Budget set" });
  // A new account has no budget yet: ask for one instead of showing a made-up number.
  const noBudget = data.settings.monthlyBudget === 0 && s.phase !== "past";
  const notes = useMemo(
    () =>
      budgetNotes(
        s,
        categoryRows(data.categories, data.transactions),
        data.settings.hardLimit,
        formatINR,
      ),
    [s, data],
  );
  const monthName = MONTHS_LONG[parseISO(data.month).m - 1];
  const headline =
    s.phase === "current"
      ? "Safe to spend today"
      : s.phase === "past"
        ? `Left in ${monthName}'s budget`
        : `Budget for ${monthName}`;
  const big = s.phase === "current" ? s.safe : s.budgetLeft;

  return (
    <section
      aria-labelledby="hero-title"
      className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    >
      <Panel
        data-tour="safe"
        className="flex flex-col justify-between gap-8 p-[clamp(24px,3.4cqw,40px)]"
      >
        <div className="flex items-center justify-between gap-3 text-[13px] text-(--p-fg3)">
          <span className="rounded-full border border-(--p-line) px-2.5 py-0.5 text-xs">
            {s.phase === "current" ? "Today" : monthLabel(data.month)}
          </span>
          <span>{longDay(data.today)}</span>
        </div>
        {noBudget ? (
          <div>
            <div id="hero-title" className="mb-3 text-[15px] text-(--p-fg2)">
              {headline}
            </div>
            <div
              className="font-display text-[clamp(84px,12cqw,168px)] leading-[.86] font-light tracking-[-.055em] text-(--p-fg3)"
              aria-hidden
            >
              —
            </div>
            <p className="mt-6 max-w-[540px] text-sm leading-[1.65] text-pretty text-(--p-fg2)">
              Set how much you want to spend in {monthName}. paisa takes off
              bills still due and goal top-ups, then splits the rest over the
              days left, so this number tells you what you can spend today.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-(--p-fg3)">Monthly budget</span>
              <div className="font-display text-[24px] tracking-[-.03em]">
                <AmountEdit
                  value={0}
                  label="Monthly budget"
                  variant="title"
                  emptyText="Set budget"
                  onSave={(amount) =>
                    saveBudget.mutateAsync({ key: "monthly", amount })
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div id="hero-title" className="mb-3 text-[15px] text-(--p-fg2)">
              {headline}
            </div>
            <div className="flex items-start gap-1 font-display text-[clamp(84px,12cqw,168px)] leading-[.86] font-light tracking-[-.055em]">
              <span className="mt-[.14em] text-[.36em] tracking-normal text-(--p-fg3)">
                {big < 0 ? "−₹" : "₹"}
              </span>
              <span>{formatNumber(Math.abs(big))}</span>
            </div>
            <p className="mt-6 max-w-[540px] text-sm leading-[1.65] text-pretty text-(--p-fg2)">
              {s.phase === "current" ? (
                <>
                  <B>{formatINR(s.budgetLeft)}</B> left in this month&apos;s
                  budget, minus <B>{formatINR(s.billsDue)}</B> in bills still
                  due and <B>{formatINR(s.goalTop)}</B> set aside for goals,
                  divided by the <B>{s.daysLeft}</B>{" "}
                  {s.daysLeft === 1 ? "day" : "days"} left.
                </>
              ) : (
                <>
                  <B>{formatINR(s.spent)}</B> spent of a{" "}
                  <B>{formatINR(data.settings.monthlyBudget)}</B> budget
                  {s.billsDue > 0 && (
                    <>
                      , with <B>{formatINR(s.billsDue)}</B> in bills{" "}
                      {s.phase === "past" ? "left unpaid" : "due"}
                    </>
                  )}
                  .
                </>
              )}
            </p>
          </div>
        )}
        <div className={noBudget ? "hidden" : undefined}>
          <div
            className="relative h-1.5 rounded-full bg-(--p-track)"
            role="img"
            aria-label={`${s.usedPct}% of budget used, ${s.elapsedPct}% of month gone`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-(--p-ink) transition-[width] duration-500"
              style={{ width: `${s.usedPct}%` }}
            />
            <div
              className="absolute -inset-y-1.5 w-0.5 rounded-full bg-(--p-accent)"
              style={{ left: `${s.elapsedPct}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-(--p-fg3)">
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-2.5 rounded-full bg-(--p-ink)" />
              {s.usedPct}% of budget used
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-0.5 rounded-full bg-(--p-accent)" />
              {s.elapsedPct}% of month gone
            </span>
          </div>
          {notes.length > 0 && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-(--p-warnLine) bg-(--p-warnTint) px-3.5 py-2.5 text-[13px] leading-normal text-(--p-warn)"
            >
              <i
                className="ri-information-line text-[16px] leading-5"
                aria-hidden
              />
              <span>{notes.join(" ")}</span>
            </div>
          )}
        </div>
      </Panel>

      <div
        data-tour="balance"
        className="grid grid-cols-1 gap-4 max-lg:grid-cols-3 max-sm:grid-cols-1"
      >
        <Stat
          label="Current balance"
          sub={data.balanceKnown ? "As of today · click to correct" : "Click to enter what your bank shows"}
        >
          <AmountEdit
            value={s.balance}
            label="Current balance"
            variant="title"
            emptyText={data.balanceKnown ? undefined : NO_DATA}
            onSave={(amount) => saveBalance.mutateAsync({ amount })}
          />
        </Stat>
        <Stat label="Saved for goals" sub="Virtual, not moved">
          {formatTotalINR(s.earmarked)}
        </Stat>
        <Stat
          label="Free to spend"
          sub="Balance − saved"
          tone={!data.balanceKnown ? undefined : s.free < 0 ? "warn" : "pos"}
        >
          {data.balanceKnown ? formatINR(s.free) : NO_DATA}
        </Stat>
      </div>
    </section>
  );
}

function Stat({
  label,
  sub,
  children,
  tone,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
  tone?: "pos" | "warn";
}) {
  return (
    <Panel className="flex flex-col justify-center">
      <div className="text-[13px] text-(--p-fg3)">{label}</div>
      <div
        className={`mt-2 font-display text-[clamp(24px,2.6cqw,32px)] tracking-[-.03em] ${
          tone === "pos"
            ? "text-(--p-pos)"
            : tone === "warn"
              ? "text-(--p-warn)"
              : ""
        }`}
      >
        {children}
      </div>
      <div className="mt-1 text-xs text-(--p-fg3)">{sub}</div>
    </Panel>
  );
}
