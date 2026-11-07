"use client";

import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { motionTokens as M } from "@/components/arc/motion-tokens";
import { cn } from "@/lib/utils";
import { useUI } from "@/stores/ui";
import { queueProductTour, startProductTour } from "./product-tour";

/**
 * First-run welcome: four short cards, each with a small animated picture of
 * what the feature does. The last card offers the spotlight tour.
 * Opens after sign-up (`queueWelcome()`) or from the header's help button.
 */

const WELCOME_KEY = "paisa:welcome";

/** Call before navigating to the app after sign-up; AppShell opens the cards on arrival. */
export function queueWelcome() {
  sessionStorage.setItem(WELCOME_KEY, "1");
}

const enter: Transition = {
  duration: M.duration.standard,
  ease: [...M.ease.enter],
};

type Slide = {
  title: string;
  body: string;
  Art: (p: { reduced: boolean }) => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    title: "Know what you can spend today",
    body: "Set a monthly budget and paisa works out one number for today. It takes off bills still due and money for goals, then splits the rest over the days left.",
    Art: SafeArt,
  },
  {
    title: "Log a spend in two seconds",
    body: "Press Ctrl/⌘ K on any page, type the amount and pick a category. Income, goal top-ups and bill reminders go in the same box.",
    Art: AddArt,
  },
  {
    title: "Bills that remind you",
    body: "Add rent, a phone plan or a subscription once. Tick it when it's paid: it's logged as a spend and the next due date is set for you.",
    Art: BillArt,
  },
  {
    title: "Save without moving money",
    body: "Set money aside for a goal. It stays in your account, it just isn't counted as free to spend, so today's number already leaves room for it.",
    Art: GoalArt,
  },
];

export function WelcomeModals() {
  const open = useUI((s) => s.welcomeOpen);
  const setOpen = useUI((s) => s.setWelcomeOpen);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const reduced = !!useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();

  // Arriving from sign-up.
  useEffect(() => {
    if (sessionStorage.getItem(WELCOME_KEY)) {
      sessionStorage.removeItem(WELCOME_KEY);
      setOpen(true);
    }
  }, [setOpen]);

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= SLIDES.length) return;
      setDir(to > i ? 1 : -1);
      setI(to);
    },
    [i],
  );

  const showAround = () => {
    setOpen(false);
    if (pathname === "/") {
      // Let the dialog leave and release focus before the tour traps it.
      window.setTimeout(startProductTour, 260);
    } else {
      queueProductTour();
      router.push("/");
    }
  };

  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* Back to the first card once it has left, so it reopens from the start. */}
      <AnimatePresence
        onExitComplete={() => {
          setI(0);
          setDir(1);
        }}
      >
        {open && (
          <DialogPrimitive.Portal forceMount key="welcome">
            <DialogPrimitive.Overlay forceMount asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-(--p-scrim) backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: M.duration.fast } }}
                transition={enter}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              forceMount
              asChild
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") go(i + 1);
                if (e.key === "ArrowLeft") go(i - 1);
              }}
            >
              <motion.div
                className="fixed inset-0 z-[51] m-auto h-fit max-h-[calc(100dvh-32px)] w-[min(calc(100vw-32px),448px)] overflow-auto rounded-[20px] border border-(--p-line) bg-(--p-surface) text-(--p-ink) shadow-(--p-shadow-floating) outline-none"
                initial={
                  reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: 4,
                        scale: 0.98,
                        transition: { duration: M.duration.fast },
                      }
                }
                transition={
                  reduced
                    ? { duration: M.duration.instant }
                    : {
                        default: M.spring.smooth,
                        opacity: { duration: M.duration.fast },
                      }
                }
              >
                <div className="flex items-center justify-between px-6 pt-5">
                  <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[.12em] text-(--p-accent) uppercase">
                    <span
                      className="size-1.5 rounded-full bg-(--p-accent)"
                      aria-hidden
                    />
                    Welcome to paisa
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs text-(--p-fg3) tabular-nums"
                      aria-live="polite"
                    >
                      {i + 1} / {SLIDES.length}
                    </span>
                    <DialogPrimitive.Close
                      aria-label="Close"
                      className="-mr-1.5 grid size-7 place-items-center rounded-full text-(--p-fg3) transition-colors hover:bg-(--p-surface2) hover:text-(--p-ink)"
                    >
                      <i className="ri-close-line text-[17px]" aria-hidden />
                    </DialogPrimitive.Close>
                  </div>
                </div>

                <div className="overflow-hidden px-6 pt-4 pb-5">
                  <AnimatePresence mode="wait" initial={false} custom={dir}>
                    <motion.div
                      key={i}
                      custom={dir}
                      initial={
                        reduced
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: 18 * dir,
                              filter: `blur(${M.blur.soft}px)`,
                            }
                      }
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              x: -12 * dir,
                              filter: `blur(${M.blur.subtle}px)`,
                              transition: { duration: M.duration.fast },
                            }
                      }
                      transition={enter}
                    >
                      <ArtFrame>
                        <slide.Art reduced={reduced} />
                      </ArtFrame>
                      <DialogPrimitive.Title className="mt-5 font-display text-[21px] font-normal tracking-[-.025em]">
                        {slide.title}
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="mt-1.5 text-[13.5px] leading-[1.6] text-pretty text-(--p-fg2)">
                        {slide.body}
                      </DialogPrimitive.Description>
                      {last && (
                        <button
                          type="button"
                          onClick={showAround}
                          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-(--p-line) px-3 text-[13px] font-medium text-(--p-accent) transition-colors hover:border-(--p-accent) hover:bg-(--p-accentTint)"
                        >
                          Show me around
                          <i
                            className="ri-arrow-right-line text-[15px]"
                            aria-hidden
                          />
                        </button>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between border-t border-(--p-line) px-6 py-4">
                  <div
                    className="flex items-center gap-1.5"
                    role="tablist"
                    aria-label="Welcome cards"
                  >
                    {SLIDES.map((s, n) => (
                      <button
                        key={s.title}
                        type="button"
                        role="tab"
                        aria-selected={n === i}
                        aria-label={`Card ${n + 1}: ${s.title}`}
                        onClick={() => go(n)}
                        className="grid h-4 place-items-center"
                      >
                        <motion.span
                          className="block h-1.5 rounded-full"
                          animate={{
                            width: n === i ? 18 : 6,
                            backgroundColor:
                              n === i
                                ? "var(--p-accent)"
                                : "var(--p-lineStrong)",
                          }}
                          transition={M.spring.snappy}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => go(i - 1)}
                        className="h-9 rounded-full border border-(--p-line) px-4 text-[13px] font-medium transition-colors hover:bg-(--p-surface2)"
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => (last ? setOpen(false) : go(i + 1))}
                      className="h-9 rounded-full bg-(--p-primary) px-4 text-[13px] font-medium text-(--p-onPrimary) transition-colors hover:bg-(--p-primaryHover)"
                    >
                      {last ? "Got it" : "Next"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/* ───────────────────────────── illustrations ───────────────────────────── */

function ArtFrame({ children }: { children: React.ReactNode }) {
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

function SafeArt({ reduced }: { reduced: boolean }) {
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

function AddArt({ reduced }: { reduced: boolean }) {
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

function BillArt({ reduced }: { reduced: boolean }) {
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

function GoalArt({ reduced }: { reduced: boolean }) {
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
