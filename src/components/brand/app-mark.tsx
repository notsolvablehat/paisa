import { cn } from "@/lib/utils";

/**
 * paisa's app icon (Concept A, "the ring with today's dot"): an open spending ring
 * echoing the hero gauge; the gap is what's left and the dot is safe-to-spend today.
 * Source: ~/Minee/App icon-html/Main.dc.html (256-unit grid, values copied as-is).
 *
 * Both of the design's variants, switched by theme: the light tile in light mode,
 * the dark tile (also the favicon, `src/app/icon.svg`) in dark mode.
 */
const ACCENT = "#E8532F";

export function AppMark({
  size = 24,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  const a11y = title
    ? { role: "img", "aria-label": title }
    : { "aria-hidden": true as const };
  return (
    <span
      className={cn("inline-grid shrink-0", className)}
      style={{ width: size, height: size }}
      {...a11y}
    >
      {/* Light theme */}
      <svg
        viewBox="0 0 256 256"
        className="col-start-1 row-start-1 size-full dark:hidden"
      >
        <rect
          x="1"
          y="1"
          width="254"
          height="254"
          rx="57"
          fill="#F4F2EC"
          stroke="#D3D0C5"
          strokeWidth="2"
        />
        <circle
          cx="128"
          cy="128"
          r="70"
          fill="none"
          stroke="#111210"
          strokeOpacity="0.1"
          strokeWidth="22"
        />
        <circle
          cx="128"
          cy="128"
          r="70"
          fill="none"
          stroke="#111210"
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray="330 110"
        />
        <circle
          cx="177.5"
          cy="78.5"
          r="11"
          fill={ACCENT}
          stroke="#111210"
          strokeWidth="3"
        />
      </svg>
      {/* Dark theme */}
      <svg
        viewBox="0 0 256 256"
        className="col-start-1 row-start-1 hidden size-full dark:block"
      >
        <rect width="256" height="256" rx="58" fill="#111210" />
        <rect
          x="1"
          y="1"
          width="254"
          height="254"
          rx="57"
          fill="none"
          stroke="#F4F2EC"
          strokeOpacity="0.12"
          strokeWidth="2"
        />
        <circle
          cx="128"
          cy="128"
          r="70"
          fill="none"
          stroke="#F4F2EC"
          strokeOpacity="0.14"
          strokeWidth="22"
        />
        <circle
          cx="128"
          cy="128"
          r="70"
          fill="none"
          stroke={ACCENT}
          strokeWidth="22"
          strokeLinecap="round"
          strokeDasharray="330 110"
        />
        <circle cx="177.5" cy="78.5" r="11" fill="#F4F2EC" />
      </svg>
    </span>
  );
}
