import { AuthCard, AuthShell, Float } from "../auth-shell";
import { SignInForm } from "../auth-forms";

export const metadata = { title: "Log in · paisa" };

const BARS = [92, 10, 18, 62, 8, 34, 46, 12, 22, 30, 4];

export default function SignInPage() {
  return (
    <AuthShell
      floats={
        <>
          <Float className="top-[24%] left-[7.5%] w-[340px]">
            <div className="text-[13px] text-(--p-fg2)">Safe to spend today</div>
            <div className="mt-1 flex items-start gap-1 font-display text-[64px] leading-[.9] font-light tracking-[-.05em]">
              <span className="mt-1 text-[22px] text-(--p-fg3)">₹</span>509
            </div>
            <div className="relative mt-5 h-1 rounded-full bg-(--p-track)">
              <div className="absolute inset-y-0 left-0 w-[47%] rounded-full bg-(--p-ink)" />
              <div className="absolute -inset-y-1 left-[33%] w-0.5 rounded-full bg-(--p-accent)" />
            </div>
            <div className="mt-2.5 text-xs text-(--p-fg3)">47% of budget used · 33% of month gone</div>
          </Float>

          <Float className="top-[32%] right-[8%] w-[310px] p-4">
            <div className="flex justify-between text-[13px] text-(--p-fg2)">
              <span>Spending · Nov</span>
              <span>₹14,206</span>
            </div>
            <div className="mt-3 flex h-[76px] items-end gap-1.5">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[3px]"
                  style={{
                    height: `${h}%`,
                    background: i === 9 ? "var(--p-ink)" : h > 40 && i !== 0 ? "var(--p-barOver)" : "var(--p-bar)",
                  }}
                />
              ))}
            </div>
          </Float>

          <Float className="bottom-[13%] left-[10.5%] flex w-[316px] items-center gap-3 px-4 py-3.5">
            <span className="grid size-5 place-items-center rounded-[6px] bg-(--p-primary) text-(--p-onPrimary)">
              <i className="ri-check-line text-[13px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Electricity · BESCOM</div>
              <div className="text-xs text-(--p-fg3)">Paid · monthly</div>
            </div>
            <span className="text-sm font-medium">₹1,420</span>
          </Float>

          <Float className="right-[8%] bottom-[18%] w-[284px] px-5 py-4">
            <div className="text-[13px] text-(--p-fg2)">Free to spend</div>
            <div className="mt-1 font-display text-[30px] tracking-[-.03em] text-(--p-pos)">₹15,900</div>
          </Float>
        </>
      }
    >
      <AuthCard title="Welcome back" subtitle="Log in to see what you can spend today.">
        <SignInForm />
      </AuthCard>
    </AuthShell>
  );
}
