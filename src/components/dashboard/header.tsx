"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/arc/button/button";
import { ExpandingSearch, type ExpandingSearchItem } from "@/components/arc/expanding-search/expanding-search";
import { ThemeSwitch, type Theme } from "@/components/arc/theme-switch/theme-switch";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { signOut } from "@/lib/auth-client";
import { addMonths, dayMonth, monthLabel } from "@/lib/dates";
import type { Range } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { Kbd, Logo, Segmented } from "./primitives";

const iconBtn =
  "grid place-items-center rounded-full text-(--p-fg3) transition-colors hover:bg-(--p-surface2) hover:text-(--p-ink) disabled:opacity-30 disabled:hover:bg-transparent";

const noop = () => () => {};

/** Reveal the new theme as a circle growing from the switch (View Transitions; plain swap elsewhere). */
export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes only knows the theme after hydration.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const theme: Theme = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const change = (next: Theme, _variant: unknown, trigger: HTMLElement) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) return setTheme(next);
    const r = trigger.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const root = document.documentElement.style;
    root.setProperty("--x", `${x}px`);
    root.setProperty("--y", `${y}px`);
    root.setProperty("--r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  };
  return { theme, change };
}

export function Header({ data, userName, loading }: { data: DashboardData; userName: string; loading: boolean }) {
  const router = useRouter();
  const setMonth = useUI((s) => s.setMonth);
  const range = useUI((s) => s.range);
  const setRange = useUI((s) => s.setRange);
  const openModal = useUI((s) => s.openModal);
  const { theme, change } = useThemeToggle();

  const current = data.today.slice(0, 7);
  const go = (n: number) => {
    const next = addMonths(data.month, n);
    setMonth(next === current ? null : next);
  };
  const topRange: Range = range === "week" ? "day" : range;

  const catBy = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const searchItems = useMemo<ExpandingSearchItem[]>(
    () => [
      ...data.transactions.map((t) => {
        const c = catBy.get(t.categoryId);
        return {
          id: `tx:${t.id}`,
          title: t.note || c?.name || "Spend",
          meta: `${formatINR(t.amount)} · ${dayMonth(t.date)} · ${c?.name ?? ""}`,
          group: "Spends this month",
          icon: <i className={c?.icon ?? "ri-receipt-line"} style={{ color: c?.color }} aria-hidden />,
          keywords: [c?.name ?? ""],
        };
      }),
      ...data.bills.map((b) => ({
        id: `bill:${b.id}`,
        title: b.name,
        meta: `${formatINR(b.amount)} · due ${dayMonth(b.dueOn)}${b.paid ? " · paid" : ""}`,
        group: "Bills",
        icon: <i className="ri-calendar-event-line" aria-hidden />,
      })),
      ...data.goals.map((g) => ({
        id: `goal:${g.id}`,
        title: g.name,
        meta: `${formatINR(g.assigned)} of ${formatINR(g.target)}`,
        group: "Goals",
        icon: <i className="ri-flag-2-line" aria-hidden />,
      })),
    ],
    [data, catBy],
  );

  const onSelect = (item: ExpandingSearchItem) => {
    const [kind, id] = item.id.split(":");
    if (kind === "tx") {
      const t = data.transactions.find((x) => x.id === id);
      if (t) openModal("Spend", { editTxId: t.id, amount: t.amount, categoryId: t.categoryId, note: t.note, date: t.date });
    } else {
      document.getElementById(kind === "bill" ? "coming-up" : "wishlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const monthNav = (short: boolean) => (
    <div className="flex items-center gap-0.5">
      <button type="button" aria-label="Previous month" onClick={() => go(-1)} className={`${iconBtn} size-8`}>
        <i className="ri-arrow-left-s-line text-[20px]" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setMonth(null)}
        title="Back to this month"
        className="min-w-[118px] text-center text-sm font-medium"
        aria-live="polite"
      >
        {monthLabel(data.month, short)}
        {loading && <span className="sr-only"> loading</span>}
      </button>
      <button type="button" aria-label="Next month" onClick={() => go(1)} disabled={data.month >= current} className={`${iconBtn} size-8`}>
        <i className="ri-arrow-right-s-line text-[20px]" aria-hidden />
      </button>
    </div>
  );

  const doSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b border-(--p-line) bg-(--p-bg)/85 backdrop-blur-md">
      {/* Desktop */}
      <div className="mx-auto hidden h-[68px] max-w-[1240px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-[clamp(20px,4vw,56px)] md:grid">
        <Logo />
        <div className="flex items-center gap-4">
          {monthNav(false)}
          <Segmented<Range>
            ariaLabel="Chart range"
            options={["day", "month", "year"]}
            labels={{ day: "Day", month: "Month", year: "Year" }}
            value={topRange}
            onChange={setRange}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <ExpandingSearch
            label="Search spends, bills and goals"
            placeholder="Search spends, bills, goals"
            items={searchItems}
            onSelect={onSelect}
            anchor="end"
            expandedWidth={320}
            emptyHint="Try a category, a shop or a bill name."
          />
          <Tooltip content={<span className="flex items-center gap-1.5">Quick add <Kbd>Ctrl K</Kbd></span>} side="bottom">
            <Button size="sm" onClick={() => openModal("Spend")}>
              <i className="ri-add-line text-[16px]" aria-hidden />
              Add
            </Button>
          </Tooltip>
          <ThemeSwitch iconOnly theme={theme} onThemeChange={change} />
          <Tooltip content={`Signed in as ${userName} · Sign out`} side="bottom">
            <button type="button" aria-label="Sign out" onClick={doSignOut} className={`${iconBtn} size-9`}>
              <i className="ri-logout-box-r-line text-[18px]" aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex h-14 items-center gap-1 px-4 md:hidden">
        <Logo small />
        <div className="flex flex-1 justify-center">{monthNav(true)}</div>
        <ThemeSwitch iconOnly theme={theme} onThemeChange={change} />
        <button type="button" aria-label="Sign out" onClick={doSignOut} className={`${iconBtn} size-11`}>
          <i className="ri-logout-box-r-line text-[18px]" aria-hidden />
        </button>
      </div>
    </header>
  );
}
