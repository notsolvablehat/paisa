"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  type Transition,
} from "motion/react";
import { motionTokens as M } from "@/components/arc/motion-tokens";
import { cn } from "@/lib/utils";

/**
 * Small animated pictures of what paisa does (safe-to-spend, quick add, bills, goals).
 * Used by the welcome cards and the landing page. Each plays once on mount;
 * pass `reduced` to show the end state without motion.
 */

const enter: Transition = {
  duration: M.duration.standard,
  ease: [...M.ease.enter],
};

export function ArtFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative grid h-[156px] place-items-center overflow-hidden rounded-[14px] border border-[color-mix(in_oklab,var(--p-accent)_22%,transparent)] bg-(--p-accentTint)"
      style={{
        backgroundImage:
          "radial-gradient(color-mix(in oklab, var(--p-accent) 28%, transparent) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      {children}
    </div>
  );
}

const card =
  "rounded-[10px] border border-(--p-line) bg-(--p-surface) shadow-(--p-shadow-raised)";

/** Rise-in for illustration parts; `d` is the delay in seconds. */
const rise = (reduced: boolean, d: number) =>
  reduced
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { ...enter, delay: d },
      };

function useCountUp(to: number, reduced: boolean, delay: number) {
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    const c = animate(0, to, {
      duration: 0.9,
      delay,
      ease: [...M.ease.standard],
      onUpdate: (x) => setV(Math.round(x / 10) * 10),
    });
    return () => c.stop();
  }, [to, reduced, delay]);
  return v;
}

export function SafeArt({ reduced }: { reduced: boolean }) {
  const n = useCountUp(1250, reduced, 0.55);
  const parts = ["Budget left", "− Bills due", "− Goals", "÷ Days left"];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-1.5">
        {parts.map((p, k) => (
          <motion.span
            key={p}
            {...rise(reduced, 0.08 + k * 0.09)}
            className={cn(card, "px-2 py-1 text-[11px] text-(--p-fg2)")}
          >
            {p}
          </motion.span>
        ))}
      </div>
      <motion.div
        {...rise(reduced, 0.45)}
        className={cn(
          card,
          "flex min-w-[176px] flex-col items-center px-5 py-2.5",
        )}
      >
        <span className="text-[10.5px] text-(--p-fg3)">
          Safe to spend today
        </span>
        <span className="font-display text-[30px] leading-tight font-light tracking-[-.04em] tabular-nums">
          <span className="mr-0.5 text-[.5em] text-(--p-fg3)">₹</span>
          {n.toLocaleString("en-IN")}
        </span>
      </motion.div>
    </div>
  );
}

function useTyped(
  text: string,
  reduced: boolean,
  startMs: number,
  stepMs = 110,
) {
  const [k, setK] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) return;
    const timers = Array.from(text, (_, j) =>
      window.setTimeout(() => setK(j + 1), startMs + j * stepMs),
    );
    return () => timers.forEach(clearTimeout);
  }, [text, reduced, startMs, stepMs]);
  return text.slice(0, k);
}

function useAfter(ms: number, reduced: boolean) {
  const [on, setOn] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setOn(true), ms);
    return () => clearTimeout(t);
  }, [ms, reduced]);
  return on;
}

export function AddArt({ reduced }: { reduced: boolean }) {
  const pressed = useAfter(250, reduced);
  const typed = useTyped("240", reduced, 750);
  const chip = useAfter(1250, reduced);
  const toast = useAfter(1750, reduced);
  return (
    <div className="relative flex w-[264px] flex-col gap-2">
      <div className="flex items-center gap-1 self-start">
        {["Ctrl", "K"].map((k) => (
          <motion.span
            key={k}
            animate={
              pressed && !reduced
                ? { y: [0, 2, 0], scale: [1, 0.94, 1] }
                : undefined
            }
            transition={{ duration: 0.28 }}
            className={cn(
              card,
              "px-1.5 py-0.5 font-mono text-[10.5px] text-(--p-fg2)",
            )}
          >
            {k}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
        animate={pressed ? { opacity: 1, scale: 1 } : undefined}
        transition={M.spring.smooth}
        className={cn(card, "flex items-center justify-between px-3 py-2.5")}
      >
        <span className="font-display text-[22px] tracking-[-.03em] tabular-nums">
          <span className="text-(--p-fg3)">₹</span>
          {typed}
          {!reduced && typed.length < 3 && (
            <span className="ml-px inline-block h-[18px] w-px animate-pulse bg-(--p-ink) align-middle" />
          )}
        </span>
        <motion.span
          initial={reduced ? false : { opacity: 0, scale: 0.7 }}
          animate={chip ? { opacity: 1, scale: 1 } : undefined}
          transition={M.spring.snappy}
          className="flex items-center gap-1.5 rounded-full border border-(--p-line) px-2 py-0.5 text-[11px]"
        >
          <span className="size-1.5 rounded-full bg-[#DE7139]" />
          Food
        </motion.span>
      </motion.div>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={toast ? { opacity: 1, y: 0 } : undefined}
        transition={M.spring.smooth}
        className="flex items-center gap-2 self-end rounded-full bg-(--p-primary) px-3 py-1 text-[11px] text-(--p-onPrimary)"
      >
        <i className="ri-check-line text-[13px]" />
        Spend added
        <span className="opacity-60">Undo</span>
      </motion.div>
    </div>
  );
}

export function BillArt({ reduced }: { reduced: boolean }) {
  const ticked = useAfter(700, reduced);
  const next = useAfter(1250, reduced);
  return (
    <div className="flex w-[264px] flex-col gap-1.5">
      <motion.div
        {...rise(reduced, 0.1)}
        className={cn(card, "flex items-center gap-2.5 px-3 py-2")}
      >
        <span
          className={cn(
            "grid size-4 place-items-center rounded-[5px] border transition-colors duration-200",
            ticked
              ? "border-(--p-pos) bg-(--p-pos) text-(--p-surface)"
              : "border-(--p-lineStrong)",
          )}
        >
          <svg viewBox="0 0 12 12" className="size-2.5">
            <motion.path
              d="M2.5 6.2 5 8.5l4.5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: ticked ? 1 : 0 }}
              transition={{ duration: 0.25 }}
            />
          </svg>
        </span>
        <span
          className={cn(
            "flex-1 text-[12.5px] transition-colors",
            ticked && "text-(--p-fg3) line-through",
          )}
        >
          Rent
        </span>
        <span className="text-[11px] text-(--p-fg3)">1 Dec</span>
        <span className="text-[12.5px] font-medium tabular-nums">₹7,000</span>
      </motion.div>
      <AnimatePresence>
        {next && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            transition={M.spring.smooth}
            className="overflow-hidden"
          >
            <div className={cn(card, "flex items-center gap-2.5 px-3 py-2")}>
              <span className="size-4 rounded-[5px] border border-(--p-lineStrong)" />
              <span className="flex-1 text-[12.5px]">Rent</span>
              <span className="rounded-full bg-(--p-accentTint) px-1.5 text-[10.5px] text-(--p-accent)">
                Next
              </span>
              <span className="text-[11px] text-(--p-fg3)">1 Jan</span>
              <span className="text-[12.5px] font-medium tabular-nums">
                ₹7,000
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={reduced ? false : { opacity: 0 }}
        animate={ticked ? { opacity: 1 } : undefined}
        className="mt-0.5 self-end text-[10.5px] text-(--p-fg3)"
      >
        Logged as a spend · Bills
      </motion.div>
    </div>
  );
}

export function GoalArt({ reduced }: { reduced: boolean }) {
  const saved = useCountUp(12000, reduced, 0.35);
  const free = 30000 - saved;
  return (
    <div className="flex w-[264px] flex-col gap-2">
      <motion.div {...rise(reduced, 0.05)} className={cn(card, "px-3 py-2.5")}>
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="font-medium">New phone</span>
          <span className="text-[11px] text-(--p-fg3) tabular-nums">
            <span className="font-medium text-(--p-ink)">
              ₹{saved.toLocaleString("en-IN")}
            </span>{" "}
            of ₹30,000
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--p-track)">
          <div
            className="h-full rounded-full bg-(--p-accent)"
            style={{ width: `${(saved / 30000) * 100}%` }}
          />
        </div>
      </motion.div>
      <motion.div {...rise(reduced, 0.2)} className="flex gap-2">
        <div className={cn(card, "flex-1 px-3 py-2")}>
          <div className="text-[10.5px] text-(--p-fg3)">In your account</div>
          <div className="text-[13px] font-medium tabular-nums">₹30,000</div>
        </div>
        <div className={cn(card, "flex-1 px-3 py-2")}>
          <div className="text-[10.5px] text-(--p-fg3)">Free to spend</div>
          <div className="text-[13px] font-medium text-(--p-pos) tabular-nums">
            ₹{free.toLocaleString("en-IN")}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
