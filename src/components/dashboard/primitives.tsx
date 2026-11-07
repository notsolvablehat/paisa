"use client";

import { Badge } from "@/components/arc/badge/badge";
import { InlineEdit } from "@/components/arc/inline-edit/inline-edit";
import { Tabs, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { FRAMES, KINDS, VIEW, shapePath, type SceneId } from "@/components/arc/blocks/empty-states/empty-states-art";
import artStyles from "@/components/arc/blocks/empty-states/empty-states.module.css";
import { formatINR, parseToPaise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AppMark } from "@/components/brand/app-mark";
import { Wordmark } from "@/components/brand/wordmark";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <AppMark size={small ? 24 : 28} />
      <Wordmark className={small ? "text-[19px]" : "text-[22px]"} />
    </div>
  );
}

export function SectionHeader({ title, right, className }: { title: string; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex min-h-9 flex-wrap items-center justify-between gap-3 px-1", className)}>
      <h2 className="font-display text-[22px] font-normal tracking-[-0.03em]">{title}</h2>
      {right}
    </div>
  );
}

/** A uiarc panel (rounded card). */
export function Panel({ className, children, ...rest }: React.ComponentProps<"div">) {
  return (
    <div className={cn("panel p-[clamp(20px,2.4cqw,28px)]", className)} {...rest}>
      {children}
    </div>
  );
}

/** Segmented control built on uiarc Tabs (animated indicator). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
  ariaLabel,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <TabsList aria-label={ariaLabel}>
        {options.map((o) => (
          <TabsTrigger key={o} value={o}>
            {labels?.[o] ?? o}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Category / source chip: uiarc Badge with the item's own colour as a dot. */
export function Chip({ color, children, className }: { color?: string; children: React.ReactNode; className?: string }) {
  return (
    <Badge
      pill
      outline
      size="sm"
      className={className}
      icon={color ? <span className="block size-1.5 rounded-full" style={{ background: color }} /> : undefined}
    >
      {children}
    </Badge>
  );
}

/**
 * Click-to-edit amount (uiarc InlineEdit). Shows "₹30,000"; accepts "30000",
 * "₹30,000" or "30000.50". Saves paise; rejected input never reaches the server.
 */
export function AmountEdit({
  value,
  label,
  onSave,
  variant = "body",
  className,
  emptyText,
}: {
  value: number; // paise
  label: string;
  onSave: (paise: number) => Promise<unknown>;
  variant?: "title" | "body";
  className?: string;
  emptyText?: string;
}) {
  return (
    <InlineEdit
      value={value === 0 && emptyText ? "" : formatINR(value)}
      placeholder={emptyText}
      label={label}
      variant={variant}
      className={className}
      validate={(next) => (next.trim() === "" || parseToPaise(next) != null ? null : "Enter an amount like 12500 or 12500.50")}
      onSave={async (next) => {
        const p = next.trim() === "" ? 0 : parseToPaise(next);
        // With an empty state, saving the same 0 still means something (e.g. "my balance is ₹0").
        if (p == null || (p === value && !(value === 0 && emptyText))) return;
        await onSave(p);
      }}
    />
  );
}

export function ProgressBar({ pct, color = "var(--p-ink)", className }: { pct: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-(--p-track)", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}

/** Empty state with uiarc's line illustration (static frame). */
export function EmptyState({
  scene = "inbox",
  title,
  children,
  action,
  compact = false,
}: {
  scene?: SceneId;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  const frame = FRAMES[scene].idle;
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-6" : "py-10")}>
      <div className={compact ? "h-[88px] w-[130px]" : "h-[120px] w-[178px]"}>
        <svg className={artStyles.art} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={frame.label}>
          {frame.prims.map((p, i) => {
            const { d, dash } = shapePath(KINDS[i]!, p.geo, p.fx[1], 0, 0);
            return (
              <path key={i} className={artStyles.shape} data-kind={KINDS[i]} data-tone={p.tone} d={d} opacity={p.fx[0]} strokeDasharray={dash} />
            );
          })}
        </svg>
      </div>
      <div className="mt-3 text-sm font-medium">{title}</div>
      {children && <p className="mt-1 max-w-[320px] text-[13px] text-(--p-fg3)">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-(--p-line) bg-(--p-surface2) px-1.5 py-px font-mono text-[11px] text-(--p-fg2)">{children}</span>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "warn" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-(--p-fg3)">{label}</div>
      <div
        className={cn(
          "mt-1 truncate font-display text-[20px] tracking-[-.02em]",
          tone === "pos" && "text-(--p-pos)",
          tone === "warn" && "text-(--p-warn)",
        )}
      >
        {value}
      </div>
    </div>
  );
}
