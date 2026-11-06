"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HttpError, useDashboard } from "@/hooks/use-dashboard";
import { computeSummary } from "@/lib/finance";
import { useUI } from "@/stores/ui";
import { Header } from "./header";
import { Hero } from "./hero";
import { Spending } from "./spending";
import { IncomeSection } from "./income";
import { Budgets } from "./budgets";
import { Wishlist } from "./wishlist";
import { Bills } from "./bills";
import { QuickAdd } from "./quick-add";
import { GoalDialog } from "./goal-dialog";
import { DashboardSkeleton } from "./skeleton";

export function Dashboard({ userName }: { userName: string }) {
  const month = useUI((s) => s.month);
  const toggleModal = useUI((s) => s.toggleModal);
  const openModal = useUI((s) => s.openModal);
  const { data, isPending, isError, error, refetch, isFetching } = useDashboard(month);
  const router = useRouter();

  // Session expired or revoked → back to sign-in.
  useEffect(() => {
    if (error instanceof HttpError && error.status === 401) router.replace("/sign-in");
  }, [error, router]);

  // Ctrl/⌘ K opens the quick-add palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleModal]);

  const summary = useMemo(() => (data ? computeSummary(data) : null), [data]);

  if (isPending) return <DashboardSkeleton />;
  if (isError || !data || !summary) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-(--p-fg2)">We couldn&apos;t load your dashboard.</p>
          <button onClick={() => refetch()} className="mt-4 h-10 rounded-full bg-(--p-primary) px-5 font-medium text-(--p-onPrimary)">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="@container relative min-h-dvh bg-(--p-bg) text-(--p-ink)">
      <Header data={data} userName={userName} loading={isFetching} />
      <main className="mx-auto box-border flex max-w-[1240px] flex-col gap-[clamp(40px,5cqw,72px)] px-[clamp(16px,4cqw,56px)] pt-[clamp(24px,4cqw,56px)] pb-40">
        <Hero data={data} s={summary} />
        <Spending data={data} s={summary} />
        <IncomeSection data={data} />
        <Budgets data={data} s={summary} />
        <Wishlist data={data} />
        <Bills data={data} />
      </main>

      <button
        type="button"
        aria-label="Add"
        onClick={() => openModal("Spend")}
        className="fixed right-5 bottom-6 z-30 grid size-14 place-items-center rounded-full bg-(--p-primary) text-(--p-onPrimary) shadow-(--p-shadow-floating) md:hidden"
      >
        <i className="ri-add-line text-[26px]" aria-hidden />
      </button>

      <QuickAdd data={data} />
      <GoalDialog />
    </div>
  );
}
