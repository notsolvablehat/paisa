"use client";

import type { SessionUser } from "@/components/dashboard/header";

import { useEffect } from "react";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { AppShell } from "./app-shell";
import { MonthPicker } from "./month-picker";
import { Hero } from "./hero";
import { RecentTransactions, Spending } from "./spending";
import { IncomeSection } from "./income";
import { Budgets } from "./budgets";
import { Wishlist } from "./wishlist";
import { Bills } from "./bills";

/** Overview: today's number first, then where money went, what's next, income, goals, limits. */
export function Dashboard({ user }: { user: SessionUser }) {
  return (
    <AppShell page="overview" user={user}>
      {(data, summary) => (
        <>
          <ScrollToHash />
          <OverviewTitle data={data} />
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
    </AppShell>
  );
}

function OverviewTitle({ data }: { data: DashboardData }) {
  const setMonth = useUI((s) => s.setMonth);
  return (
    <div className="-mb-[clamp(16px,2.5cqw,40px)] flex flex-wrap items-center justify-between gap-3 px-1">
      <h1 className="font-display text-[clamp(28px,3.2cqw,36px)] font-normal tracking-[-.03em]">Overview</h1>
      <MonthPicker month={data.month} current={data.today.slice(0, 7)} onChange={setMonth} />
    </div>
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
