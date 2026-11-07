"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  HttpError,
  useDashboard,
  useResetSession,
} from "@/hooks/use-dashboard";
import { computeSummary, type Summary } from "@/lib/finance";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { Header, type Page, type SessionUser } from "./header";
import { QuickAdd } from "./quick-add";
import { GoalDialog } from "./goal-dialog";
import { DashboardSkeleton } from "./skeleton";
import { ProductTour } from "./product-tour";
import { WelcomeModals } from "./welcome-modals";

/**
 * Everything the signed-in pages share: dashboard data (categories, goals… for
 * quick add and search), the header, Ctrl/⌘ K, the mobile add button and dialogs.
 */
export function AppShell({
  page,
  user,
  children,
}: {
  page: Page;
  user: SessionUser;
  children: (data: DashboardData, summary: Summary) => React.ReactNode;
}) {
  const storeMonth = useUI((s) => s.month);
  // Only the overview is month-scoped; other pages work off the current month's data.
  const month = page === "overview" ? storeMonth : null;
  const toggleModal = useUI((s) => s.toggleModal);
  const openModal = useUI((s) => s.openModal);
  const { data, isPending, isError, error, refetch } = useDashboard(month);
  const router = useRouter();

  // Session expired or revoked → back to sign-in.
  const resetSession = useResetSession();
  useEffect(() => {
    if (error instanceof HttpError && error.status === 401) {
      resetSession();
      router.replace("/sign-in");
    }
  }, [error, router, resetSession]);

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
          <p className="text-(--p-fg2)">We couldn&apos;t load your data.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 h-10 rounded-full bg-(--p-primary) px-5 font-medium text-(--p-onPrimary)"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="@container relative min-h-dvh bg-(--p-bg) text-(--p-ink)">
      <Header data={data} user={user} page={page} />
      <main className="mx-auto box-border flex max-w-[1240px] flex-col gap-[clamp(40px,5cqw,72px)] px-[clamp(16px,4cqw,56px)] pt-[clamp(24px,4cqw,56px)] pb-40">
        {children(data, summary)}
      </main>

      <button
        type="button"
        aria-label="Add"
        data-tour="add"
        onClick={() => openModal("Spend")}
        className="fixed right-5 bottom-6 z-30 grid size-14 place-items-center rounded-full bg-(--p-primary) text-(--p-onPrimary) shadow-(--p-shadow-floating) md:hidden"
      >
        <i className="ri-add-line text-[26px]" aria-hidden />
      </button>

      <QuickAdd data={data} />
      <GoalDialog />
      <WelcomeModals />
      {page === "overview" && <ProductTour />}
    </div>
  );
}
