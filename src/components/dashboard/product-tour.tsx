"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { Coachmark } from "coachmark";
import { cn } from "@/lib/utils";

/**
 * Spotlight tour of the Overview (coachmark), offered from the last welcome
 * card. Targets are found by `data-tour="<key>"` so sections don't need refs
 * threaded through; steps whose target isn't rendered (e.g. the desktop Add
 * button on mobile) are skipped.
 *
 * Started with `startProductTour()` on the overview, or `queueProductTour()`
 * before navigating there. (Not a URL param: changing search params remounts
 * the page segment, which unmounted the tour mid-way.)
 */

type Side = "top" | "bottom" | "left" | "right";
type TourStep = {
  key: string;
  title: string;
  body: string;
  side: Side;
  align?: "start" | "center" | "end";
  radius?: number;
};

const STEPS: TourStep[] = [
  {
    key: "safe",
    title: "Your number for today",
    body: "Set a monthly budget here and this becomes what you can spend today. It updates as you log spends.",
    side: "right",
    align: "start",
    radius: 24,
  },
  {
    key: "balance",
    title: "Balance, saved and free",
    body: "Your balance moves with what you log. Click it to enter what your bank shows right now.",
    side: "left",
    align: "start",
    radius: 24,
  },
  {
    key: "add",
    title: "Add from anywhere",
    body: "Spends, income, goal top-ups and bill reminders. Ctrl/⌘ K opens it without the mouse.",
    side: "bottom",
    align: "end",
    radius: 999,
  },
  {
    key: "spending",
    title: "See where it went",
    body: "Spend by day, week, month or year. Category budgets sit right next to it: click one to set it.",
    side: "right",
    align: "start",
    radius: 24,
  },
  {
    key: "bills",
    title: "What's coming up",
    body: "Your next bills. Tick one when it's paid; the + adds a new reminder.",
    side: "left",
    align: "start",
    radius: 24,
  },
  {
    key: "goals",
    title: "Your wishlist",
    body: "Goals you're saving for. Money you assign is earmarked, not moved.",
    side: "top",
    align: "start",
    radius: 24,
  },
  {
    key: "nav",
    title: "Everything else",
    body: "Transactions has every spend and income with filters and totals. Reminders lists all bills, overdue first.",
    side: "bottom",
    align: "start",
    radius: 999,
  },
];

const START_EVENT = "paisa:start-tour";
/** Matches Tailwind's `max-sm`. */
const COMPACT = "(max-width: 639px)";
const subscribeCompact = (cb: () => void) => {
  const q = window.matchMedia(COMPACT);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};
const QUEUE_KEY = "paisa:tour";

/** Start the tour on the current (overview) page. */
export function startProductTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

/** Start the tour once the overview mounts (call before navigating to `/`). */
export function queueProductTour() {
  sessionStorage.setItem(QUEUE_KEY, "1");
}

/** First element for `key` that's actually rendered (desktop and mobile copies can both exist). */
function findTarget(key: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-tour="${key}"]`,
  ))
    if (el.getClientRects().length > 0) return el;
  return null;
}

const primaryBtn =
  "h-9 rounded-full bg-(--p-primary) px-4 text-[13px] font-medium text-(--p-onPrimary)";

type Found = { step: TourStep; ref: RefObject<HTMLElement | null> };

export function ProductTour() {
  const [steps, setSteps] = useState<Found[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const pendingOpen = useRef(false);
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT).matches,
    () => false,
  );

  const start = useCallback(() => {
    const found = STEPS.flatMap((step) => {
      const el = findTarget(step.key);
      return el ? [{ step, ref: { current: el } }] : [];
    });
    if (found.length === 0) return;
    window.scrollTo({ top: 0 });
    setOpen(false);
    setIndex(0);
    setSteps(found);
    // Open on the next commit, once the root has the new steps.
    pendingOpen.current = true;
  }, []);

  useEffect(() => {
    if (!pendingOpen.current || steps.length === 0) return;
    pendingOpen.current = false;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [steps]);

  useEffect(() => {
    window.addEventListener(START_EVENT, start);
    let id = 0;
    if (sessionStorage.getItem(QUEUE_KEY)) {
      sessionStorage.removeItem(QUEUE_KEY);
      id = requestAnimationFrame(() => start());
    }
    return () => {
      window.removeEventListener(START_EVENT, start);
      cancelAnimationFrame(id);
    };
  }, [start]);

  // Stable children: the root re-derives its active step from them, so don't rebuild them on unrelated renders.
  const stepEls = useMemo(
    () =>
      steps.map(({ step, ref }, n) => (
        <Coachmark.Step
          key={step.key}
          target={ref}
          spotlightPadding={8}
          spotlightRadius={step.radius ?? 16}
        >
          <Coachmark.Positioner
            side={step.side}
            align={step.align ?? "center"}
            sideOffset={20}
            collisionPadding={16}
            // Phones: no room beside tall sections, so the tip becomes a card pinned to the bottom
            // (overrides Base UI's inline position); the target is scrolled to the top instead.
            className="z-[70] max-sm:fixed! max-sm:inset-x-4! max-sm:top-auto! max-sm:bottom-[calc(16px+env(safe-area-inset-bottom))]! max-sm:[transform:none]!"
          >
            <Coachmark.Popup
              className={cn(
                "relative flex w-[min(320px,calc(100vw-32px))] origin-(--transform-origin) max-sm:w-full flex-col gap-2 rounded-[20px] border border-(--p-line) bg-(--p-surface) p-5 text-(--p-ink) shadow-(--p-shadow-floating) outline-none",
                "transition-[opacity,scale] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              )}
            >
              <Coachmark.Stepper
                className="flex items-center gap-1"
                aria-hidden
              >
                {({ stepIndex, stepCount }) =>
                  Array.from({ length: stepCount }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        i === stepIndex
                          ? "w-5 bg-(--p-accent)"
                          : "w-1.5 bg-(--p-track)",
                      )}
                    />
                  ))
                }
              </Coachmark.Stepper>
              <Coachmark.Title className="mt-2 font-display text-[19px] font-normal tracking-[-.02em]">
                {step.title}
              </Coachmark.Title>
              <Coachmark.Description className="text-[13.5px] leading-[1.6] text-pretty text-(--p-fg2)">
                {step.body}
              </Coachmark.Description>
              <div className="mt-3 flex items-center justify-between gap-3">
                {n < steps.length - 1 ? (
                  <Coachmark.Close className="text-[13px] text-(--p-fg3) hover:text-(--p-ink)">
                    Skip tour
                  </Coachmark.Close>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-1.5">
                  <Coachmark.Previous className="h-9 rounded-full px-3.5 text-[13px] font-medium text-(--p-fg2) hover:bg-(--p-surface2) hover:text-(--p-ink)">
                    Back
                  </Coachmark.Previous>
                  {n < steps.length - 1 ? (
                    <Coachmark.Next className={primaryBtn}>
                      {({ stepIndex, stepCount }) =>
                        `Next · ${stepIndex + 1}/${stepCount}`
                      }
                    </Coachmark.Next>
                  ) : (
                    // Not Coachmark.Next: its finish() never calls onOpenChange when `open` is
                    // controlled (coachmark 0.1.1), so the tour wouldn't close. Close does.
                    <Coachmark.Close className={primaryBtn}>
                      Done
                    </Coachmark.Close>
                  )}
                </div>
              </div>
            </Coachmark.Popup>
          </Coachmark.Positioner>
        </Coachmark.Step>
      )),
    [steps],
  );

  if (steps.length === 0) return null;

  return (
    <Coachmark.Root
      open={open}
      onOpenChange={setOpen}
      stepIndex={index}
      onStepChange={setIndex}
      scrollIntoView={{
        behavior: "smooth",
        block: compact ? "start" : "center",
      }}
    >
      <Coachmark.Backdrop
        className={cn(
          "fixed inset-0 z-[60] bg-black/55 transition-[opacity,clip-path] duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
          "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        )}
      />
      {stepEls}
    </Coachmark.Root>
  );
}
