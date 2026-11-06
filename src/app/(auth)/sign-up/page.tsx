import { AuthCard, AuthShell, Float } from "../auth-shell";
import { SignUpForm } from "../auth-forms";

export const metadata = { title: "Create your account · paisa" };

const CHIPS = [
  { name: "Food", icon: "ri-restaurant-2-line", color: "#DE7139" },
  { name: "Groceries", icon: "ri-shopping-basket-2-line", color: "#28A984", on: true },
  { name: "Transport", icon: "ri-bus-2-line", color: "#2B95DE" },
  { name: "Entertainment", icon: "ri-film-line", color: "#9E435A" },
];

export default function SignUpPage() {
  return (
    <AuthShell
      floats={
        <>
          <Float className="top-[24%] left-[6.5%] w-[366px]">
            <div className="text-[11px] font-medium tracking-[.12em] text-(--p-fg3) uppercase">Wishlist</div>
            <div className="mt-2 font-display text-[22px] tracking-[-.02em]">MacBook Air M4</div>
            <div className="mt-3 flex justify-between text-[13px]">
              <span>
                <span className="font-medium">₹38,000</span> <span className="text-(--p-fg3)">of ₹99,900</span>
              </span>
              <span className="text-(--p-fg3)">38%</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-(--p-track)">
              <div className="h-full w-[38%] rounded-full bg-(--p-accent)" />
            </div>
            <div className="mt-3 flex justify-between text-xs text-(--p-fg3)">
              <span>₹6,000 / month</span>
              <span>Ready by Oct 2027</span>
            </div>
          </Float>

          <Float className="top-[31%] right-[7%] w-[304px]">
            <div className="text-[13px] text-(--p-fg2)">Free to spend</div>
            <div className="mt-1 font-display text-[34px] tracking-[-.03em] text-(--p-pos)">₹15,900</div>
            <div className="mt-1 text-xs text-(--p-fg3)">₹62,400 balance − ₹46,500 saved</div>
          </Float>

          <Float className="bottom-[15%] left-[10.5%] flex w-[316px] flex-wrap gap-2 p-4">
            {CHIPS.map((c) => (
              <span
                key={c.name}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${
                  c.on ? "border-(--p-ink) bg-(--p-surface2)" : "border-(--p-line)"
                }`}
              >
                <i className={c.icon} style={{ color: c.color }} />
                {c.name}
              </span>
            ))}
          </Float>

          <Float className="right-[9%] bottom-[16%] flex w-[310px] items-center gap-3 px-4 py-3.5">
            <span className="size-2 rounded-full bg-(--p-accent)" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Netflix</div>
              <div className="text-xs text-(--p-fg3)">in 3 days · monthly</div>
            </div>
            <span className="text-sm font-medium">₹649</span>
          </Float>
        </>
      }
    >
      <AuthCard title="Create your account" subtitle="Set a monthly budget and see your daily number in under a minute.">
        <SignUpForm />
      </AuthCard>
    </AuthShell>
  );
}
