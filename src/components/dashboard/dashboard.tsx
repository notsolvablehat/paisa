"use client";

import { useEffect } from "react";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { LoadFailed, useAppData } from "./app-shell";
import { LoadingPanel, SectionHeader } from "./primitives";
import { todayISO } from "@/lib/dates";
import { MonthPicker } from "./month-picker";
import { Hero } from "./hero";
import { RecentTransactions, Spending } from "./spending";
import { IncomeSection } from "./income";
import { Budgets } from "./budgets";
import { Wishlist } from "./wishlist";
import { Bills } from "./bills";

/** Overview: today's number first, then where money went, what's next, income, goals, limits. */
export function Dashboard() {
  const { data, summary, failed, retry } = useAppData();
  return (
    <>
      <OverviewTitle data={data} />
      {failed ? (
        <LoadFailed onRetry={retry} />
      ) : !data || !summary ? (
        <OverviewLoading />
      ) : (
        <>
          <ScrollToHash />
          <Hero data={data} s={summary} />
          <Spending data={data} s={summary} />
          <div className="grid gap-[clamp(40px,5cqw,72px)] lg:grid-cols-2 lg:gap-5">
            <RecentTransactions data={data} />
            <Bills data={data} />
          </div>
          <IncomeSection data={data} />
          <Wishlist data={data} />
          <Budgets data={data} s={summary} />
        </>
      )}
    </>
  );
}

/** The month on show comes from the store, so the title (and picker) render before any data. */
function OverviewTitle({ data }: { data: DashboardData | undefined }) {
  const setMonth = useUI((s) => s.setMonth);
  const storeMonth = useUI((s) => s.month);
  const current = (data?.today ?? todayISO()).slice(0, 7);
  const month = storeMonth ?? current;
  return (
    <div className="-mb-[clamp(16px,2.5cqw,40px)] flex flex-wrap items-center justify-between gap-3 px-1">
      <h1 className="font-display text-[clamp(28px,3.2cqw,36px)] font-normal tracking-[-.03em]">
        Overview
      </h1>
      <MonthPicker
        month={month}
        current={current}
        onChange={setMonth}
        loading={!data || data.month !== month}
      />
    </div>
  );
}

/** Same outline as the loaded page, a spinner in each card. */
function OverviewLoading() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <LoadingPanel className="min-h-[420px]" label="Loading safe to spend" />
        <div className="grid gap-4 max-lg:grid-cols-3 max-sm:grid-cols-1">
          <LoadingPanel className="min-h-28" label="Loading balance" />
          <LoadingPanel className="min-h-28" label="Loading goals" />
          <LoadingPanel className="min-h-28" label="Loading free to spend" />
        </div>
      </div>
      <section>
        <SectionHeader title="Spending" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <LoadingPanel className="min-h-[420px]" label="Loading spending" />
          <LoadingPanel className="min-h-[420px]" label="Loading categories" />
        </div>
      </section>
      <div className="grid gap-[clamp(40px,5cqw,72px)] lg:grid-cols-2 lg:gap-5">
        <section>
          <SectionHeader title="Recent" />
          <LoadingPanel className="min-h-72" label="Loading recent spends" />
        </section>
        <section>
          <SectionHeader title="Coming up" />
          <LoadingPanel className="min-h-72" label="Loading reminders" />
        </section>
      </div>
      {["Income", "Wishlist", "Budgets"].map((t) => (
        <section key={t}>
          <SectionHeader title={t} />
          <LoadingPanel label={`Loading ${t.toLowerCase()}`} />
        </section>
      ))}
    </>
  );
}

/** Links like /#coming-up arrive before the data renders, so scroll once it's there. */
function ScrollToHash() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
