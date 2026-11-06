"use client";

import { Button } from "@/components/arc/button/button";
import { goalReadyBy } from "@/lib/finance";
import { formatINR } from "@/lib/money";
import type { DashboardData } from "@/lib/types";
import { useUI } from "@/stores/ui";
import { EmptyState, Panel, ProgressBar, SectionHeader } from "./primitives";

export function Wishlist({ data }: { data: DashboardData }) {
  const openModal = useUI((s) => s.openModal);
  const setGoalDialogOpen = useUI((s) => s.setGoalDialogOpen);
  const earmarked = data.goals.reduce((a, g) => a + g.assigned, 0);
  const n = data.goals.length;

  return (
    <section aria-label="Wishlist" id="wishlist" className="scroll-mt-24">
      <SectionHeader
        title="Wishlist"
        right={
          <Button size="sm" variant="secondary" onClick={() => setGoalDialogOpen(true)}>
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
            Name it, set a price, pick a monthly amount. Money you assign stays in your account — it&apos;s just earmarked.
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-[15px] text-(--p-fg2)">
              <span className="font-medium text-(--p-ink)">{formatINR(earmarked)}</span> earmarked across {n} goal{n === 1 ? "" : "s"},
              already subtracted from your free balance.
            </p>
            <ul>
              {data.goals.map((g) => {
                const pct = Math.min(100, Math.round((g.assigned / g.target) * 100));
                const funded = g.assigned >= g.target;
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-(--p-line) py-5 first:border-0">
                    <div className="min-w-0 flex-[1_1_220px]">
                      <div className="font-display text-[clamp(18px,1.8cqw,22px)] tracking-[-.02em]">{g.name}</div>
                      <div className="mt-1 text-xs text-(--p-fg3)">Ready by {goalReadyBy(g, data.today.slice(0, 7))}</div>
                    </div>
                    <div className="min-w-0 flex-[2_1_300px]">
                      <div className="mb-2.5 flex justify-between text-[13px]">
                        <span>
                          <span className="font-medium">{formatINR(g.assigned)}</span> <span className="text-(--p-fg3)">of {formatINR(g.target)}</span>
                        </span>
                        <span className="text-(--p-fg3)">{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} color="var(--p-accent)" />
                    </div>
                    <div className="min-w-[110px] flex-none text-[13px] text-(--p-fg2)">
                      <span className="font-medium text-(--p-ink)">{formatINR(g.monthly)}</span> / month
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={funded}
                      onClick={() => openModal("Goal contribution", { goalId: g.id })}
                    >
                      <i className={funded ? "ri-check-line text-[16px]" : "ri-add-line text-[16px]"} aria-hidden />
                      {funded ? "Funded" : "Assign ₹"}
                    </Button>
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
