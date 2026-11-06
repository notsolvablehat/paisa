export function DashboardSkeleton() {
  const bar = "animate-pulse rounded-[4px] bg-(--p-surface2)";
  return (
    <div className="min-h-dvh bg-(--p-bg)" aria-busy="true" aria-label="Loading your dashboard">
      <div className="h-16 border-b border-(--p-line)" />
      <div className="mx-auto max-w-[1240px] px-[clamp(20px,4vw,56px)] pt-[clamp(32px,6vw,88px)]">
        <div className={`${bar} h-3 w-24`} />
        <div className={`${bar} mt-10 h-4 w-40`} />
        <div className={`${bar} mt-4 h-[clamp(88px,13vw,176px)] w-[min(100%,420px)]`} />
        <div className={`${bar} mt-8 h-3 w-[min(100%,520px)]`} />
        <div className={`${bar} mt-16 h-1.5 w-full`} />
      </div>
    </div>
  );
}
