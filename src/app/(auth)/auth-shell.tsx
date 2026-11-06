import { Logo } from "@/components/dashboard/primitives";

/**
 * Backdrop for sign-in / sign-up: concentric rings, soft colour blobs and
 * floating preview cards (decorative only — hidden from assistive tech and
 * on small screens).
 */
export function AuthShell({ children, floats }: { children: React.ReactNode; floats: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-(--p-bg)">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 size-[440px] rounded-full bg-(--p-blob-warm)" />
        <div className="absolute -bottom-32 -left-28 size-[340px] rounded-full bg-(--p-blob-cool)" />
        {[1240, 960, 640].map((s) => (
          <div
            key={s}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--p-line)"
            style={{ width: s, height: s }}
          />
        ))}
        <div className="absolute top-[17%] left-[25%] size-16 rounded-full bg-(--p-pos) max-lg:hidden" />
        <div className="absolute right-[29%] bottom-[14%] size-7 rounded-full bg-(--p-accent) max-lg:hidden" />
      </div>

      <header className="absolute top-0 left-0 p-7">
        <Logo />
      </header>

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-[5] max-lg:hidden">
        {floats}
      </div>

      <main className="grid min-h-dvh place-items-center px-5 py-24">{children}</main>

      <footer className="absolute inset-x-0 bottom-6 text-center text-[13px] text-(--p-fg3)">© paisa · your numbers stay private</footer>
    </div>
  );
}

/** A small decorative preview card. */
export function Float({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`absolute rounded-[var(--radius-panel)] border border-(--p-line) bg-(--p-surface) p-5 shadow-(--p-shadow-raised) ${className}`}>
      {children}
    </div>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[432px] rounded-[var(--radius-surface)] border border-(--p-line) bg-(--p-surface) p-8 shadow-(--p-shadow-floating) max-sm:rounded-[var(--radius-panel)] max-sm:p-6">
      <div className="mb-6 grid gap-2">
        <h1 className="font-display text-[34px] leading-[1.1] font-normal tracking-[-0.035em] text-balance">{title}</h1>
        <p className="text-sm leading-[1.45] text-(--p-fg2) text-pretty">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
