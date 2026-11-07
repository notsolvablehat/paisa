"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { motionTokens as M } from "@/components/arc/motion-tokens";
import {
  AddArt,
  ArtFrame,
  BillArt,
  GoalArt,
  SafeArt,
} from "@/components/brand/feature-art";
import { cn } from "@/lib/utils";

const enter = [...M.ease.enter] as [number, number, number, number];

/** Fades content up the first time it scrolls into view. Text stays in the HTML for crawlers. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.6, ease: enter, delay }}
    >
      {children}
    </Tag>
  );
}

const ARTS = {
  safe: SafeArt,
  add: AddArt,
  bill: BillArt,
  goal: GoalArt,
} as const;

/** One of the feature illustrations, started when it scrolls into view (they play once on mount). */
export function FeatureArt({ kind }: { kind: keyof typeof ARTS }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduced = !!useReducedMotion();
  const Art = ARTS[kind];
  return (
    <div ref={ref}>
      <ArtFrame>{inView ? <Art reduced={reduced} /> : null}</ArtFrame>
    </div>
  );
}

function useCount(to: number, start: boolean, reduced: boolean, delay = 0) {
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!start || reduced) return;
    const c = animate(0, to, {
      duration: 1.1,
      delay,
      ease: [...M.ease.standard],
      onUpdate: (x) => setV(Math.round(x / 10) * 10),
    });
    return () => c.stop();
  }, [to, start, reduced, delay]);
  return v;
}

/** Hero picture: the spending ring fills, today's number counts up, and a few live-looking cards float around it. */
export function HeroCard() {
  const reduced = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const n = useCount(1250, inView, reduced, 0.35);
  const R = 70;
  const C = 2 * Math.PI * R;
  const used = 0.58; // share of the month's budget already spent

  const float = (d: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14, scale: 0.96 },
          animate: inView ? { opacity: 1, y: [0, -6, 0], scale: 1 } : undefined,
          transition: {
            opacity: { duration: 0.5, delay: d, ease: enter },
            scale: { duration: 0.5, delay: d, ease: enter },
            y: {
              duration: 5 + d * 2,
              delay: d + 0.5,
              repeat: Infinity,
              ease: "easeInOut" as const,
            },
          },
        };

  const tile =
    "rounded-[16px] border border-(--p-line) bg-(--p-surface) shadow-(--p-shadow-raised)";

  return (
    <div
      ref={ref}
      aria-hidden
      className="relative mx-auto aspect-square w-full max-w-[460px]"
    >
      {/* soft rings behind */}
      {[100, 78, 56].map((s) => (
        <div
          key={s}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--p-line)"
          style={{ width: `${s}%`, height: `${s}%` }}
        />
      ))}

      <motion.div
        className={cn(
          tile,
          "absolute top-1/2 left-1/2 flex w-[64%] -translate-x-1/2 -translate-y-1/2 flex-col items-center px-6 py-7",
        )}
        initial={reduced ? false : { opacity: 0, scale: 0.94 }}
        animate={inView ? { opacity: 1, scale: 1 } : undefined}
        transition={{ ...M.spring.smooth, delay: 0.1 }}
      >
        <svg viewBox="0 0 180 180" className="w-[62%]">
          <circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="var(--p-track)"
            strokeWidth="14"
          />
          <motion.circle
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke="var(--p-accent)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            transform="rotate(-90 90 90)"
            initial={reduced ? false : { strokeDashoffset: C }}
            animate={inView ? { strokeDashoffset: C * (1 - used) } : undefined}
            transition={{ duration: 1.3, delay: 0.3, ease: enter }}
            style={reduced ? { strokeDashoffset: C * (1 - used) } : undefined}
          />
          <motion.circle
            cx="90"
            cy={90 - R}
            r="7"
            fill="var(--p-ink)"
            transform={`rotate(${used * 360 + 18} 90 90)`}
            initial={reduced ? false : { opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ delay: 1.5, duration: 0.3 }}
          />
        </svg>
        <div className="mt-4 text-[12px] text-(--p-fg3)">
          Safe to spend today
        </div>
        <div className="font-display text-[clamp(34px,6vw,46px)] leading-none font-light tracking-[-.05em] tabular-nums">
          <span className="mr-0.5 text-[.45em] text-(--p-fg3)">₹</span>
          {n.toLocaleString("en-IN")}
        </div>
      </motion.div>

      <motion.div
        {...float(0.7)}
        className={cn(
          tile,
          "absolute top-[6%] left-0 flex items-center gap-2.5 px-3.5 py-2.5 sm:left-[-4%]",
        )}
      >
        <span className="grid size-5 place-items-center rounded-[6px] bg-(--p-pos) text-white">
          <i className="ri-check-line text-[13px]" />
        </span>
        <span className="text-[13px] font-medium">Rent paid</span>
        <span className="text-[12px] text-(--p-fg3)">next: 1 Jan</span>
      </motion.div>

      <motion.div
        {...float(0.95)}
        className={cn(
          tile,
          "absolute top-[18%] right-0 w-[40%] px-3.5 py-3 sm:right-[-6%]",
        )}
      >
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="font-medium">New phone</span>
          <span className="text-(--p-fg3)">40%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--p-track)">
          <motion.div
            className="h-full rounded-full bg-(--p-accent)"
            initial={reduced ? false : { width: 0 }}
            animate={inView ? { width: "40%" } : undefined}
            transition={{ duration: 1, delay: 1.2, ease: enter }}
            style={reduced ? { width: "40%" } : undefined}
          />
        </div>
      </motion.div>

      <motion.div
        {...float(1.2)}
        className={cn(
          tile,
          "absolute bottom-[8%] left-[4%] flex items-center gap-2 px-3.5 py-2.5",
        )}
      >
        <span className="size-2 rounded-full bg-[#DE7139]" />
        <span className="text-[13px]">Swiggy · dinner</span>
        <span className="text-[13px] font-medium tabular-nums">₹420</span>
      </motion.div>

      <motion.div
        {...float(1.45)}
        className={cn(tile, "absolute right-[2%] bottom-[16%] px-3.5 py-2.5")}
      >
        <div className="text-[11px] text-(--p-fg3)">Free to spend</div>
        <div className="text-[17px] font-medium text-(--p-pos) tabular-nums">
          ₹18,000
        </div>
      </motion.div>
    </div>
  );
}

/** "Budget left − Bills due − Goals ÷ Days left = Today", one term at a time. */
export function Formula({
  terms,
}: {
  terms: { label: string; value: string; op?: string }[];
}) {
  const reduced = useReducedMotion();
  return (
    <ol className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
      {terms.map((t, i) => (
        <motion.li
          key={t.label}
          className="flex items-center gap-2 sm:gap-3"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.5, ease: enter, delay: i * 0.14 }}
        >
          {t.op && (
            <span
              aria-hidden
              className="hidden font-display text-[22px] text-(--p-fg3) sm:inline"
            >
              {t.op}
            </span>
          )}
          <span
            className={cn(
              "flex flex-col rounded-[14px] border px-4 py-3",
              i === terms.length - 1
                ? "border-(--p-ink) bg-(--p-ink) text-(--p-bg)"
                : "border-(--p-line) bg-(--p-surface)",
            )}
          >
            <span
              className={cn(
                "text-[12px]",
                i === terms.length - 1 ? "opacity-70" : "text-(--p-fg3)",
              )}
            >
              {/* Phones: the operator rides inside the card so a wrapped line never starts with a lone "−". */}
              {t.op && <span className="sm:hidden">{t.op} </span>}
              {t.label}
            </span>
            <span className="font-display text-[20px] tracking-[-.02em] tabular-nums">
              {t.value}
            </span>
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
