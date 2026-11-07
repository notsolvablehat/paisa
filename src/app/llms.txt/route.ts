import { DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * /llms.txt (https://llmstxt.org): a plain-text summary for AI assistants and answer engines,
 * so they can describe paisa accurately. Keep it in step with the landing page copy.
 */
export function GET() {
  const body = `# ${SITE_NAME}

> ${DESCRIPTION}

${SITE_NAME} is a web app (works on desktop and phones, installable to the home screen). It is built for India: amounts in rupees (₹) with lakh formatting, dates in Indian Standard Time, and exact integer maths down to the paisa. It does not connect to bank accounts, cards or SMS; people log spends and income themselves.

## The core idea

Most budget apps show where money went. ${SITE_NAME} answers "how much can I spend today?":

safe to spend today = (monthly budget left − bills still due this month − planned goal top-ups) ÷ days left in the month, rounded down to the nearest ₹100.

## Features

- Safe-to-spend-today number on the overview, with budget used vs. month elapsed.
- Quick add (Ctrl/⌘ K) for spends, income, goal contributions and bill reminders.
- Bills and reminders: once, monthly or yearly. Ticking a bill paid logs it as a spend and schedules the next due date; overdue bills stay visible.
- Savings goals ("wishlist"): money is earmarked, not moved, and comes off the free-to-spend balance.
- Budgets: monthly, daily, per category, and a hard limit, with early warnings.
- Charts by day, week, month and year; spending by category.
- Transactions and Reminders pages with search, filters, sorting and totals for any date range.
- Light and dark themes.

## Privacy

Data is only used to show it back to the account owner. Every read and write is checked against the signed-in account. No ads or third-party trackers.

## Links

- Home: ${SITE_URL}/
- Create a free account: ${SITE_URL}/sign-up
- Log in: ${SITE_URL}/sign-in
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
