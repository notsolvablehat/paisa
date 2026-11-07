import type { Metadata } from "next";
import Link from "next/link";
import { AppMark } from "@/components/brand/app-mark";
import { Wordmark } from "@/components/brand/wordmark";
import { Logo } from "@/components/dashboard/primitives";
import {
  FeatureArt,
  Formula,
  HeroCard,
  Reveal,
} from "@/components/landing/motion";
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from "@/lib/site";

/**
 * Public landing page (static). Signed-in visitors never see it: the proxy sends them to /overview.
 * Copy lives here, server-rendered, so search engines and AI assistants read it without running JS.
 */

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME}: ${TAGLINE.toLowerCase()} | Budget app for India`,
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    art: "add" as const,
    title: "Log a spend in two seconds",
    body: "Press Ctrl/⌘ K on any page, type the amount, pick a category. Income, goal top-ups and bill reminders go in the same box.",
  },
  {
    art: "bill" as const,
    title: "Bills that remind you",
    body: "Add rent, a phone plan or a subscription once. Tick it when it's paid: it's logged as a spend and the next due date is set for you.",
  },
  {
    art: "goal" as const,
    title: "Save without moving money",
    body: "Set money aside for a goal. It stays in your account but isn't counted as free to spend, so today's number already leaves room for it.",
  },
  {
    art: "safe" as const,
    title: "Budgets that warn you early",
    body: "Category budgets, a daily budget and a hard limit you never want to cross. paisa tells you before you get there, not after.",
  },
];

const MORE = [
  {
    icon: "ri-bar-chart-2-line",
    title: "See where it went",
    body: "Spending by day, week, month or year, and by category.",
  },
  {
    icon: "ri-search-line",
    title: "Find anything",
    body: "Search every spend, bill and goal; filter and total any date range.",
  },
  {
    icon: "ri-smartphone-line",
    title: "Made for your phone",
    body: "Works in any browser. Add it to your home screen like an app.",
  },
  {
    icon: "ri-moon-line",
    title: "Light and dark",
    body: "Follows your system, or pick one.",
  },
];

const FAQ = [
  {
    q: "What is paisa?",
    a: "paisa is a personal finance app for India that turns your monthly budget into one number: how much is safe to spend today. It also tracks your spends, income, bills and savings goals in rupees.",
  },
  {
    q: "How is “safe to spend today” calculated?",
    a: "paisa takes what's left of your monthly budget, subtracts bills that are still due this month and the money you plan to put towards goals, then divides the rest by the days left in the month. It's rounded down to the nearest ₹100 so it never suggests more than is actually safe.",
  },
  {
    q: "Does paisa connect to my bank account?",
    a: "No. You log spends and income yourself (it takes a couple of seconds), so paisa never needs your bank login, card details or SMS access.",
  },
  {
    q: "Is my data private?",
    a: "Your numbers are only used to show them back to you. Every request is checked against your own account, and there are no ads or third-party trackers.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. paisa works in any modern mobile browser, and you can add it to your home screen so it opens full-screen like an app.",
  },
  {
    q: "Is paisa only for India?",
    a: "It's built India-first: amounts in rupees with lakh formatting, dates in Indian time, and exact maths down to the paisa. Anyone can use it, but it currently works in ₹ only.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires a modern web browser",
      inLanguage: "en-IN",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      featureList: [
        "Safe-to-spend-today number",
        "Quick add for spends and income",
        "Recurring bill reminders",
        "Savings goals without moving money",
        "Category, daily and hard-limit budgets",
        "Spending charts and search",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "en-IN",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const primaryCta =
  "inline-flex h-12 items-center gap-2 rounded-full bg-(--p-primary) px-6 text-[15px] font-medium text-(--p-onPrimary) transition-colors hover:bg-(--p-primaryHover)";
const secondaryCta =
  "inline-flex h-12 items-center rounded-full border border-(--p-line) px-6 text-[15px] font-medium transition-colors hover:bg-(--p-surface2)";

export default function LandingPage() {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-(--p-bg) text-(--p-ink)">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden"
      >
        <div className="absolute -top-48 -right-40 size-[520px] rounded-full bg-(--p-blob-warm) blur-2xl" />
        <div className="absolute top-[360px] -left-40 size-[380px] rounded-full bg-(--p-blob-cool) blur-2xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-transparent bg-(--p-bg)/80 backdrop-blur-md">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-[1160px] items-center gap-6 px-5 sm:px-8"
        >
          <Link href="/" aria-label="paisa home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-1 text-sm text-(--p-fg2) md:flex">
            {[
              ["#how", "How it works"],
              ["#features", "Features"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-2 transition-colors hover:text-(--p-ink)"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-full px-3 py-2 text-sm font-medium text-(--p-fg2) transition-colors hover:text-(--p-ink)"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center rounded-full bg-(--p-primary) px-4 text-sm font-medium text-(--p-onPrimary) transition-colors hover:bg-(--p-primaryHover)"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1160px] items-center gap-12 px-5 pt-[clamp(40px,8vw,96px)] pb-[clamp(56px,8vw,112px)] sm:px-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-(--p-line) bg-(--p-surface) px-3 py-1 text-[13px] text-(--p-fg2)">
                <span className="size-1.5 rounded-full bg-(--p-accent)" />
                Budgeting for India, minus the spreadsheets
              </span>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 font-display text-[clamp(44px,7vw,80px)] leading-[.98] font-normal tracking-[-.045em] text-balance">
                Know what&apos;s safe to spend{" "}
                <span className="text-(--p-accent)">today.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-[520px] text-[17px] leading-[1.6] text-pretty text-(--p-fg2)">
                Most budget apps tell you where your money went. paisa tells you
                what you can spend right now: your budget left, minus bills
                still due and money for goals, split over the days left in the
                month.
              </p>
            </Reveal>
            <Reveal delay={0.24} className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-up" className={primaryCta}>
                Create your free account
                <i className="ri-arrow-right-line text-[17px]" aria-hidden />
              </Link>
              <a href="#how" className={secondaryCta}>
                See how it works
              </a>
            </Reveal>
            <Reveal delay={0.32}>
              <p className="mt-5 text-[13px] text-(--p-fg3)">
                No bank login needed · works on your phone · ₹ first
              </p>
            </Reveal>
          </div>
          <HeroCard />
        </section>

        {/* How it works */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="scroll-mt-20 border-y border-(--p-line) bg-(--p-surface)/60"
        >
          <div className="mx-auto max-w-[1160px] px-5 py-[clamp(56px,8vw,104px)] text-center sm:px-8">
            <Reveal>
              <p className="text-[12px] font-semibold tracking-[.12em] text-(--p-accent) uppercase">
                How it works
              </p>
              <h2
                id="how-title"
                className="mx-auto mt-3 max-w-[720px] font-display text-[clamp(30px,4.4vw,48px)] leading-[1.05] font-normal tracking-[-.035em] text-balance"
              >
                One number, worked out for you every morning
              </h2>
            </Reveal>
            <div className="mt-12">
              <Formula
                terms={[
                  { label: "Budget left", value: "₹36,500" },
                  { op: "−", label: "Bills still due", value: "₹4,000" },
                  { op: "−", label: "Goal top-ups", value: "₹2,500" },
                  { op: "÷", label: "Days left", value: "24" },
                  { op: "=", label: "Safe to spend today", value: "₹1,250" },
                ]}
              />
            </div>
            <ol className="mx-auto mt-14 grid max-w-[960px] gap-6 text-left sm:grid-cols-3">
              {[
                [
                  "Set a monthly budget",
                  "Pick what you want to spend this month. Category budgets are optional.",
                ],
                [
                  "Log as you go",
                  "Add a spend in seconds, tick bills when they're paid, put money towards goals.",
                ],
                [
                  "Check one number",
                  "Spend under today's number and the month takes care of itself.",
                ],
              ].map(([t, b], i) => (
                <Reveal
                  as="li"
                  key={t}
                  delay={i * 0.08}
                  className="rounded-[20px] border border-(--p-line) bg-(--p-bg) p-6"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-(--p-accentTint) font-display text-[15px] text-(--p-accent)">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[17px] font-medium">{t}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-[1.6] text-(--p-fg2)">
                    {b}
                  </p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="mx-auto max-w-[1160px] scroll-mt-20 px-5 py-[clamp(56px,8vw,112px)] sm:px-8"
        >
          <Reveal className="max-w-[640px]">
            <p className="text-[12px] font-semibold tracking-[.12em] text-(--p-accent) uppercase">
              Features
            </p>
            <h2
              id="features-title"
              className="mt-3 font-display text-[clamp(30px,4.4vw,48px)] leading-[1.05] font-normal tracking-[-.035em] text-balance"
            >
              Everything you need, nothing you have to maintain
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 2) * 0.08}
                className="rounded-[24px] border border-(--p-line) bg-(--p-surface) p-5 sm:p-6"
              >
                <FeatureArt kind={f.art} />
                <h3 className="mt-5 font-display text-[22px] font-normal tracking-[-.025em]">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-[1.6] text-pretty text-(--p-fg2)">
                  {f.body}
                </p>
              </Reveal>
            ))}
          </div>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MORE.map((m, i) => (
              <Reveal
                as="li"
                key={m.title}
                delay={i * 0.06}
                className="rounded-[20px] border border-(--p-line) p-5"
              >
                <i
                  className={`${m.icon} text-[20px] text-(--p-accent)`}
                  aria-hidden
                />
                <h3 className="mt-3 text-[15px] font-medium">{m.title}</h3>
                <p className="mt-1 text-[14px] leading-[1.55] text-(--p-fg2)">
                  {m.body}
                </p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Privacy */}
        <section
          aria-labelledby="privacy-title"
          className="mx-auto max-w-[1160px] px-5 sm:px-8"
        >
          <Reveal className="grid gap-8 rounded-[28px] bg-(--p-ink) p-[clamp(28px,5vw,56px)] text-(--p-bg) md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <h2
                id="privacy-title"
                className="font-display text-[clamp(28px,4vw,42px)] leading-[1.05] font-normal tracking-[-.035em] text-balance"
              >
                Your numbers stay yours
              </h2>
              <p className="mt-4 max-w-[480px] text-[15.5px] leading-[1.6] opacity-75">
                No bank logins, no SMS reading, no ads. paisa only knows what
                you tell it, and only you can see it.
              </p>
            </div>
            <ul className="grid gap-3 text-[15px]">
              {[
                "Nothing linked to your bank or cards",
                "Every request checked against your own account",
                "Amounts stored exactly, to the paisa",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <i
                    className="ri-shield-check-line mt-0.5 text-[18px] text-(--p-accent)"
                    aria-hidden
                  />
                  <span className="opacity-90">{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          aria-labelledby="faq-title"
          className="mx-auto max-w-[820px] scroll-mt-20 px-5 py-[clamp(56px,8vw,112px)] sm:px-8"
        >
          <Reveal>
            <h2
              id="faq-title"
              className="text-center font-display text-[clamp(30px,4.4vw,44px)] font-normal tracking-[-.035em]"
            >
              Questions, answered
            </h2>
          </Reveal>
          <div className="mt-10 divide-y divide-(--p-line) border-y border-(--p-line)">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <i
                    className="ri-add-line text-[20px] text-(--p-fg3) transition-transform duration-200 group-open:rotate-45"
                    aria-hidden
                  />
                </summary>
                <p className="pb-5 text-[15px] leading-[1.65] text-(--p-fg2)">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1160px] px-5 pb-[clamp(64px,9vw,120px)] text-center sm:px-8">
          <Reveal className="flex flex-col items-center">
            <AppMark size={56} />
            <h2 className="mt-6 max-w-[640px] font-display text-[clamp(32px,5vw,56px)] leading-[1.02] font-normal tracking-[-.04em] text-balance">
              Stop guessing at month-end.
            </h2>
            <p className="mt-4 max-w-[460px] text-[16px] text-(--p-fg2)">
              Set a budget in a minute and see today&apos;s number straight
              away.
            </p>
            <Link href="/sign-up" className={`${primaryCta} mt-8`}>
              Get started, it&apos;s free
              <i className="ri-arrow-right-line text-[17px]" aria-hidden />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-(--p-line)">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-(--p-fg3) sm:px-8">
          <span className="flex items-center gap-1.5">
            © <Wordmark className="text-[13px] text-(--p-fg2)" /> ·{" "}
            {TAGLINE.toLowerCase()}
          </span>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/sign-in" className="hover:text-(--p-ink)">
              Log in
            </Link>
            <Link href="/sign-up" className="hover:text-(--p-ink)">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
