import { cn } from "@/lib/utils";

/**
 * The "paisa." wordmark: heavy, tightly tracked lowercase with a round full stop
 * sitting on the baseline. Takes font-size and colour from its context (pass classes to change them).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-sans leading-none font-bold tracking-[-0.045em]",
        className,
      )}
      aria-label="paisa"
      role="img"
    >
      <span aria-hidden>paisa</span>
      <span
        aria-hidden
        className="ml-[0.1em] inline-block size-[0.26em] shrink-0 rounded-full bg-(--p-dot)"
      />
    </span>
  );
}
