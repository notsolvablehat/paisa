"use client";

import { createContext, use, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HttpError,
  useDashboard,
  useResetSession,
} from "@/hooks/use-dashboard";
import { computeSummary, type Summary } from "@/lib/finance";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { Header, pageFromPath, type SessionUser } from "./header";
import { QuickAdd } from "./quick-add";
import { GoalDialog } from "./goal-dialog";
import { ProductTour } from "./product-tour";
import { WelcomeModals } from "./welcome-modals";

type AppData = {
  /** Undefined until the first dashboard response arrives; each section shows its own spinner meanwhile. */
  data: DashboardData | undefined;
  summary: Summary | undefined;
  /** First load failed (nothing to show yet). */
  failed: boolean;
  retry: () => void;
};

const AppDataContext = createContext<AppData | null>(null);

/** Dashboard data shared by every signed-in page (loaded once by the layout, kept across navigation). */
export function useAppData(): AppData {
  const ctx = use(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppFrame");
  return ctx;
}

/**
 * Everything the signed-in pages share, mounted once by the (app) layout so it stays put while
 * you move between pages: the header, dashboard data (categories, goals… for quick add and
 * search), Ctrl/⌘ K, the mobile add button and the dialogs. Pages render inside `<main>`.
 */
export function AppFrame({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const page = pageFromPath(usePathname());
  const storeMonth = useUI((s) => s.month);
  // Only the overview is month-scoped; other pages work off the current month's data.
  const month = page === "overview" ? storeMonth : null;
  const toggleModal = useUI((s) => s.toggleModal);
  const openModal = useUI((s) => s.openModal);
  const { data, isError, error, refetch } = useDashboard(month);
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

  const summary = useMemo(
    () => (data ? computeSummary(data) : undefined),
    [data],
  );
  const ctx = useMemo<AppData>(
    () => ({
      data,
      summary,
      failed: isError && !data,
      retry: () => void refetch(),
    }),
    [data, summary, isError, refetch],
  );

  return (
    <AppDataContext value={ctx}>
      <div className="@container relative min-h-dvh bg-(--p-bg) text-(--p-ink)">
        <Header data={data} user={user} page={page} />
        <main className="mx-auto box-border flex max-w-[1240px] flex-col gap-[clamp(40px,5cqw,72px)] px-[clamp(16px,4cqw,56px)] pt-[clamp(24px,4cqw,56px)] pb-40">
          {children}
        </main>

        <button
          type="button"
          aria-label="Add"
          data-tour="add"
          disabled={!data}
          onClick={() => openModal("Spend")}
          className="fixed right-5 bottom-6 z-30 grid size-14 place-items-center rounded-full bg-(--p-primary) text-(--p-onPrimary) shadow-(--p-shadow-floating) disabled:opacity-60 md:hidden"
        >
          <i className="ri-add-line text-[26px]" aria-hidden />
        </button>

        {data && (
          <>
            <QuickAdd data={data} />
            <GoalDialog />
            <WelcomeModals />
            {page === "overview" && <ProductTour />}
          </>
        )}
      </div>
    </AppDataContext>
  );
}

/** Shown in place of a page's data-driven sections when the first load failed. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div>
        <p className="text-(--p-fg2)">We couldn&apos;t load your data.</p>
        <button
          onClick={onRetry}
          className="mt-4 h-10 rounded-full bg-(--p-primary) px-5 font-medium text-(--p-onPrimary)"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
