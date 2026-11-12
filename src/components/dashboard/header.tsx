"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/arc/button/button";
import {
  ExpandingSearch,
  type ExpandingSearchItem,
} from "@/components/arc/expanding-search/expanding-search";
import {
  UserMenu,
  type ThemePreference,
} from "@/components/arc/user-menu/user-menu";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { signOut } from "@/lib/auth-client";
import { useResetSession } from "@/hooks/use-dashboard";
import { avatarDataUri } from "@/lib/avatar";
import { APP_HOME } from "@/lib/site";
import { dayMonth } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { Kbd, Logo } from "./primitives";

export type Page = "overview" | "transactions" | "reminders";

const NAV: { page: Page; href: string; label: string; icon: string }[] = [
  {
    page: "overview",
    href: APP_HOME,
    label: "Overview",
    icon: "ri-dashboard-horizontal-line",
  },
  {
    page: "transactions",
    href: "/transactions",
    label: "Transactions",
    icon: "ri-list-unordered",
  },
  {
    page: "reminders",
    href: "/reminders",
    label: "Reminders",
    icon: "ri-calendar-event-line",
  },
];

/** Which nav item a path belongs to (the layout is shared, so the header reads it from the URL). */
export function pageFromPath(path: string): Page {
  return (
    NAV.find((n) => n.href !== APP_HOME && path.startsWith(n.href))?.page ??
    "overview"
  );
}

const noop = () => () => {};

/**
 * Theme preference (light / dark / system). A change that flips the visible theme is revealed
 * as a circle growing from `origin` (View Transitions; plain swap elsewhere or with reduced motion).
 */
export function useThemeToggle() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();
  // next-themes only knows the theme after hydration.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const preference: ThemePreference =
    mounted && (theme === "dark" || theme === "system") ? theme : "light";
  const change = (next: ThemePreference, origin?: HTMLElement | null) => {
    const nextResolved = next === "system" ? systemTheme : next;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (
      !document.startViewTransition ||
      reduce ||
      !origin ||
      nextResolved === resolvedTheme
    )
      return setTheme(next);
    const r = origin.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const root = document.documentElement.style;
    root.setProperty("--x", `${x}px`);
    root.setProperty("--y", `${y}px`);
    root.setProperty(
      "--r",
      `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`,
    );
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  };
  return { preference, change };
}

export type SessionUser = { name: string; email: string };

export function Header({
  data,
  user,
  page,
}: {
  /** Undefined while the first load is in flight: search waits, everything else works. */
  data: DashboardData | undefined;
  user: SessionUser;
  page: Page;
}) {
  // Highlight the clicked item straight away; the URL catches up when the page has rendered.
  const pathname = usePathname();
  const [pending, setPending] = useState<{ from: string; to: Page } | null>(
    null,
  );
  const shown = pending && pending.from === pathname ? pending.to : page;
  const router = useRouter();
  const openModal = useUI((s) => s.openModal);
  const setWelcomeOpen = useUI((s) => s.setWelcomeOpen);
  const { preference, change } = useThemeToggle();

  const catBy = useMemo(
    () => new Map((data?.categories ?? []).map((c) => [c.id, c])),
    [data],
  );
  const searchItems = useMemo<ExpandingSearchItem[]>(
    () =>
      !data
        ? []
        : [
            ...data.transactions.map((t) => {
              const c = catBy.get(t.categoryId);
              return {
                id: `tx:${t.id}`,
                title: t.note || c?.name || "Spend",
                meta: `${formatINR(t.amount)} · ${dayMonth(t.date)} · ${c?.name ?? ""}`,
                group: "Spends this month",
                icon: (
                  <i
                    className={c?.icon ?? "ri-receipt-line"}
                    style={{ color: c?.color }}
                    aria-hidden
                  />
                ),
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
    if (!data) return;
    const [kind, id] = item.id.split(":");
    if (kind === "tx") {
      const t = data.transactions.find((x) => x.id === id);
      if (t)
        openModal("Spend", {
          editTxId: t.id,
          amount: t.amount,
          categoryId: t.categoryId,
          note: t.note,
          date: t.date,
        });
    } else {
      if (kind === "bill") router.push("/reminders");
      else if (page === "overview")
        document
          .getElementById("wishlist")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      else router.push(`${APP_HOME}#wishlist`);
    }
  };

  const nav = (compact: boolean) => (
    <nav aria-label="Pages" data-tour="nav" className="flex items-center gap-1">
      {NAV.map((n) => (
        <Link
          key={n.page}
          href={n.href}
          onClick={() => {
            if (n.page !== page) setPending({ from: pathname, to: n.page });
          }}
          aria-current={shown === n.page ? "page" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-full font-medium transition-colors",
            compact ? "h-9 px-3 text-[13px]" : "h-9 px-3.5 text-sm",
            shown === n.page
              ? "bg-(--p-surface2) text-(--p-ink)"
              : "text-(--p-fg3) hover:text-(--p-ink)",
          )}
        >
          <i className={cn(n.icon, "text-[16px]")} aria-hidden />
          {n.label}
        </Link>
      ))}
    </nav>
  );

  const resetSession = useResetSession();
  const doSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
    router.refresh();
    resetSession();
  };

  // One menu per layout (desktop / mobile); the theme reveal grows from whichever avatar was used.
  const avatarSrc = useMemo(() => avatarDataUri(user.email), [user.email]);
  const desktopMenu = useRef<HTMLButtonElement>(null);
  const mobileMenu = useRef<HTMLButtonElement>(null);
  const userMenu = (ref: React.RefObject<HTMLButtonElement | null>) => (
    <UserMenu
      ref={ref}
      user={{ name: user.name, email: user.email, avatarSrc }}
      theme={preference}
      onThemeChange={(t) => change(t, ref.current)}
      items={[
        {
          label: "How paisa works",
          icon: <i className="ri-question-line text-[15px]" aria-hidden />,
          onSelect: () => setWelcomeOpen(true),
        },
      ]}
      onSignOut={doSignOut}
    />
  );

  return (
    <header className="sticky top-0 z-20 border-b border-(--p-line) bg-(--p-bg)/85 backdrop-blur-md">
      {/* Desktop */}
      <div className="mx-auto hidden h-[68px] max-w-[1240px] grid-cols-[auto_minmax(0,1fr)] items-center gap-6 px-[clamp(20px,4vw,56px)] md:grid">
        <div className="flex items-center gap-6">
          <Logo />
          {nav(false)}
        </div>
        <div className="flex items-center justify-end gap-2">
          <div className="w-[clamp(220px,24vw,320px)]">
            <ExpandingSearch
              label="Search spends, bills and goals"
              placeholder="Search spends, bills, goals"
              items={searchItems}
              onSelect={onSelect}
              anchor="end"
              expandedWidth={320}
              emptyHint="Try a category, a shop or a bill name."
            />
          </div>
          <Tooltip
            content={
              <span className="flex items-center gap-1.5">
                Quick add <Kbd>Ctrl K</Kbd>
              </span>
            }
            side="bottom"
          >
            <Button
              size="sm"
              data-tour="add"
              disabled={!data}
              onClick={() => openModal("Spend")}
            >
              <i className="ri-add-line text-[16px]" aria-hidden />
              Add
            </Button>
          </Tooltip>
          <div className="ml-1">{userMenu(desktopMenu)}</div>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex h-14 items-center gap-1 px-4 md:hidden">
        <Logo small />
        <div className="flex-1" />
        {userMenu(mobileMenu)}
      </div>
      <div className="flex justify-center border-t border-(--p-line) py-1.5 md:hidden">
        {nav(true)}
      </div>
    </header>
  );
}
