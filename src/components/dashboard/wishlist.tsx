"use client";

import { Button } from "@/components/arc/button/button";
import { useAction } from "@/hooks/use-dashboard";
import { setGoalPaused } from "@/server/actions";
import { goalReadyBy } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import {
  Chip,
  EmptyState,
  Panel,
  ProgressBar,
  SectionHeader,
} from "./primitives";

export function Wishlist({ data }: { data: DashboardData }) {
  const openModal = useUI((s) => s.openModal);
  const setGoalDialogOpen = useUI((s) => s.setGoalDialogOpen);
  const pause = useAction(setGoalPaused, {
    success: (_, i) => (i.paused ? "Goal paused" : "Goal resumed"),
  });
  const earmarked = data.goals.reduce((a, g) => a + g.assigned, 0);
  const n = data.goals.length;
  const nPaused = data.goals.filter((g) => g.paused).length;
  // Active goals first; paused ones sink to the bottom.
  const goals = [...data.goals].sort(
    (a, b) => Number(a.paused) - Number(b.paused),
  );

  return (
    <section
      aria-label="Wishlist"
      data-tour="goals"
      id="wishlist"
      className="scroll-mt-24"
    >
      <SectionHeader
        title="Wishlist"
        right={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setGoalDialogOpen(true)}
          >
            <i className="ri-add-line text-[16px]" aria-hidden />
            New goal
          </Button>
        }
      />
      <Panel>
        {n === 0 ? (
          <EmptyState
            scene="map"
            title="No goals yet"
            action={
              <Button size="sm" onClick={() => setGoalDialogOpen(true)}>
                Create a goal
              </Button>
            }
          >
            Name it, set a price, pick a monthly amount. Money you assign stays
            in your account — it&apos;s just earmarked.
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-[15px] text-(--p-fg2)">
              <span className="font-medium text-(--p-ink)">
                {formatINR(earmarked)}
              </span>{" "}
              earmarked across {n} goal{n === 1 ? "" : "s"}, already subtracted
              from your free balance.
              {nPaused > 0 &&
                ` ${nPaused} paused — ${nPaused === 1 ? "its" : "their"} monthly amount isn't counted in safe to spend.`}
            </p>
            <ul>
              {goals.map((g) => {
                const pct = Math.min(
                  100,
                  Math.round((g.assigned / g.target) * 100),
                );
                const funded = g.assigned >= g.target;
                const busy =
                  pause.isPending && pause.variables?.goalId === g.id;
                return (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-(--p-line) py-5 first:border-0"
                  >
                    <div className="min-w-0 flex-[1_1_220px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            g.paused
                              ? "font-display text-[clamp(18px,1.8cqw,22px)] tracking-[-.02em] text-(--p-fg3)"
                              : "font-display text-[clamp(18px,1.8cqw,22px)] tracking-[-.02em]"
                          }
                        >
                          {g.name}
                        </span>
                        {g.paused && <Chip>Paused</Chip>}
                      </div>
                      <div className="mt-1 text-xs text-(--p-fg3)">
                        {g.paused
                          ? "Not counted in safe to spend"
                          : funded
                            ? "Fully funded"
                            : `Ready by ${goalReadyBy(g, data.today.slice(0, 7))}`}
                      </div>
                    </div>
                    <div className="min-w-0 flex-[2_1_300px]">
                      <div className="mb-2.5 flex justify-between text-[13px]">
                        <span>
                          <span className="font-medium">
                            {formatINR(g.assigned)}
                          </span>{" "}
                          <span className="text-(--p-fg3)">
                            of {formatINR(g.target)}
                          </span>
                        </span>
                        <span className="text-(--p-fg3)">{pct}%</span>
                      </div>
                      <ProgressBar
                        pct={pct}
                        color={g.paused ? "var(--p-fg3)" : "var(--p-accent)"}
                      />
                    </div>
                    <div className="min-w-[110px] flex-none text-[13px] text-(--p-fg2)">
                      <span className="font-medium text-(--p-ink)">
                        {formatINR(g.monthly)}
                      </span>{" "}
                      / month
                    </div>
                    <div className="flex flex-none items-center gap-1.5">
                      {!funded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busy}
                          aria-label={`${g.paused ? "Resume" : "Pause"} ${g.name}`}
                          onClick={() =>
                            pause.mutate({ goalId: g.id, paused: !g.paused })
                          }
                        >
                          <i
                            className={
                              g.paused
                                ? "ri-play-line text-[16px]"
                                : "ri-pause-line text-[16px]"
                            }
                            aria-hidden
                          />
                          {g.paused ? "Resume" : "Pause"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={funded || g.paused}
                        onClick={() =>
                          openModal("Goal contribution", { goalId: g.id })
                        }
                      >
                        <i
                          className={
                            funded
                              ? "ri-check-line text-[16px]"
                              : "ri-add-line text-[16px]"
                          }
                          aria-hidden
                        />
                        {funded ? "Funded" : "Assign ₹"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </section>
  );
}
