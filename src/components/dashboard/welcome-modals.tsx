"use client";

import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { motionTokens as M } from "@/components/arc/motion-tokens";
import { APP_HOME } from "@/lib/site";
import { useUI } from "@/stores/ui";
import { queueProductTour, startProductTour } from "./product-tour";
import {
  AddArt,
  ArtFrame,
  BillArt,
  GoalArt,
  SafeArt,
} from "@/components/brand/feature-art";

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
    if (pathname === APP_HOME) {
      // Let the dialog leave and release focus before the tour traps it.
      window.setTimeout(startProductTour, 260);
    } else {
      queueProductTour();
      router.push(APP_HOME);
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
