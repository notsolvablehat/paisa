import { describe, expect, it } from "vitest";
import { addMonths, addMonthsToDate, daysInMonth, diffDays, todayISO } from "./dates";
import {
  billRows,
  billsSummary,
  buildChart,
  categoryRows,
  computeSummary,
  goalDueThisMonth,
  goalReadyBy,
  relativeDue,
} from "./finance";
import { formatINR, formatK, paiseToInput, paiseToRupees, parseRupees, parseToPaise, rupeesToPaise } from "./money";
import type { DashboardData } from "./types";

const P = rupeesToPaise;
const fmt = formatINR;

/** The scenario from the design file: 11 Nov 2026. */
function fixture(over: Partial<DashboardData> = {}): DashboardData {
  const cats = [
    { id: "rent", name: "Rent", icon: "ri-home-4-line", color: "#9390A2", budget: P(7000) },
    { id: "food", name: "Food", icon: "ri-restaurant-2-line", color: "#DE7139", budget: P(3000) },
    { id: "bills", name: "Bills", icon: "ri-file-list-3-line", color: "#57534E", budget: P(4000) },
    { id: "travel", name: "Travel", icon: "ri-plane-line", color: "#33ACFF", budget: 0 },
  ];
  const tx = (id: string, d: number, cat: string, amt: number) => ({
    id, categoryId: cat, amount: P(amt), note: "", date: `2026-11-${String(d).padStart(2, "0")}`, billId: null,
  });
  return {
    today: "2026-11-11",
    month: "2026-11",
    settings: { monthlyBudget: P(30000), dailyBudget: P(1000), hardLimit: P(34000) },
    balance: P(62400),
    balanceKnown: true,
    categories: cats,
    transactions: [tx("1", 1, "rent", 7000), tx("2", 1, "food", 420), tx("3", 10, "food", 2800), tx("4", 10, "food", 3986)],
    income: [
      { id: "i1", source: "Salary", amount: P(20000), note: "", date: "2026-11-01" },
      { id: "i2", source: "Freelance", amount: P(4000), note: "", date: "2026-11-05" },
    ],
    recentIncome: [],
    goals: [{ id: "g1", name: "MacBook", target: P(99900), monthly: P(465), assigned: P(38000), contributedInMonth: 0 }],
    bills: [
      { id: "b1", name: "Water", amount: P(180), dueOn: "2026-11-08", recurrence: "Monthly", categoryId: "bills", paid: false },
      { id: "b2", name: "Power", amount: P(1420), dueOn: "2026-11-13", recurrence: "Monthly", categoryId: "bills", paid: false },
      { id: "b3", name: "Paid one", amount: P(500), dueOn: "2026-11-02", recurrence: "Once", categoryId: "bills", paid: true },
      { id: "b4", name: "Domain", amount: P(899), dueOn: "2027-01-03", recurrence: "Yearly", categoryId: "bills", paid: false },
    ],
    history: {
      months: Array.from({ length: 12 }, (_, i) => ({ month: addMonths("2026-11", i - 11), spent: P(25000), income: P(24000) })),
      years: [
        { year: 2024, spent: P(264000), income: P(288000) },
        { year: 2025, spent: P(302000), income: P(324000) },
        { year: 2026, spent: P(280000), income: P(290000) },
      ],
      incomeBySource: [],
    },
    ...over,
  };
}

describe("money", () => {
  it("round-trips rupees and paise exactly", () => {
    expect(rupeesToPaise(14206)).toBe(1420600);
    expect(paiseToRupees(1420600)).toBe(14206);
    expect(paiseToRupees(150)).toBe(2); // half rounds away from zero
    expect(paiseToRupees(-150)).toBe(-2);
  });
  it("rejects non-integer rupees", () => {
    expect(() => rupeesToPaise(1.5)).toThrow();
  });
  it("formats Indian grouping", () => {
    expect(formatINR(P(1234567))).toBe("₹12,34,567");
    expect(formatINR(P(-500))).toBe("−₹500");
    expect(formatK(P(24300))).toBe("₹24.3k");
  });
  it("parses typed amounts", () => {
    expect(parseRupees("12,500")).toBe(12500);
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("1000000000")).toBeNull();
  });
  it("parses typed amounts to paise without float error", () => {
    expect(parseToPaise("₹12,500")).toBe(1250000);
    expect(parseToPaise("0.1")).toBe(10);
    expect(parseToPaise("19.99")).toBe(1999);
    expect(parseToPaise("1.234")).toBeNull();
    expect(parseToPaise("abc")).toBeNull();
    expect(parseToPaise("")).toBeNull();
    expect(paiseToInput(1250050)).toBe("12500.50");
    expect(paiseToInput(1250000)).toBe("12500");
  });
});

describe("dates", () => {
  it("knows month lengths incl. leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 11)).toBe(30);
  });
  it("shifts months and clamps days", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-11-15", 12)).toBe("2027-11-15");
  });
  it("diffs days across months", () => {
    expect(diffDays("2026-11-11", "2027-01-03")).toBe(53);
    expect(diffDays("2026-11-11", "2026-11-08")).toBe(-3);
  });
  it("computes today in the app timezone", () => {
    // 20:00 UTC on 6 Nov is already 7 Nov in India.
    expect(todayISO(new Date("2026-11-06T20:00:00Z"), "Asia/Kolkata")).toBe("2026-11-07");
  });
});

describe("safe to spend", () => {
  it("matches the design's formula", () => {
    const s = computeSummary(fixture());
    expect(s.spent).toBe(P(14206));
    expect(s.budgetLeft).toBe(P(15794));
    // Unpaid & due by month end: 180 + 1420 (paid bill & January bill excluded)
    expect(s.billsDue).toBe(P(1600));
    expect(s.goalTop).toBe(P(465));
    expect(s.daysLeft).toBe(20);
    // floor((15794 − 1600 − 465) / 20) = 686
    expect(s.safe).toBe(P(686));
    expect(s.usedPct).toBe(47);
    expect(s.elapsedPct).toBe(33);
    expect(s.free).toBe(P(62400 - 38000));
  });

  it("never goes negative", () => {
    const s = computeSummary(fixture({ settings: { monthlyBudget: P(1000), dailyBudget: P(100), hardLimit: P(2000) } }));
    expect(s.safe).toBe(0);
  });

  it("has no days left for a past month", () => {
    const s = computeSummary(fixture({ month: "2026-10", transactions: [], income: [] }));
    expect(s.phase).toBe("past");
    expect(s.daysLeft).toBe(0);
    expect(s.safe).toBe(0);
    expect(s.elapsedPct).toBe(100);
  });

  it("buckets spend by day", () => {
    const s = computeSummary(fixture());
    expect(s.daily[0]).toBe(P(7420));
    expect(s.daily[9]).toBe(P(6786));
    expect(s.todaySpent).toBe(0);
    expect(s.avgDaily).toBe(P(14206) / 10);
  });
});

describe("goals", () => {
  it("reduces this month's goal set-aside as money is assigned", () => {
    const g = { target: P(1000), assigned: P(300), monthly: P(200), contributedInMonth: P(50) };
    expect(goalDueThisMonth(g)).toBe(P(150));
  });
  it("caps the set-aside at what is left of the target", () => {
    expect(goalDueThisMonth({ target: P(1000), assigned: P(950), monthly: P(200), contributedInMonth: 0 })).toBe(P(50));
    expect(goalDueThisMonth({ target: P(1000), assigned: P(1000), monthly: P(200), contributedInMonth: 0 })).toBe(0);
  });
  it("projects a ready-by month", () => {
    expect(goalReadyBy({ target: P(99900), assigned: P(38000), monthly: P(6000) }, "2026-11")).toBe("Oct 2027");
    expect(goalReadyBy({ target: P(100), assigned: P(100), monthly: P(10) }, "2026-11")).toBe("now");
  });
});

describe("categories", () => {
  it("flags over-budget categories and hides empty unbudgeted ones", () => {
    const d = fixture();
    const rows = categoryRows(d.categories, d.transactions);
    expect(rows.map((r) => r.name)).toEqual(["Food", "Rent", "Bills"]);
    const food = rows.find((r) => r.id === "food")!;
    expect(food.over).toBe(true);
    expect(food.pct).toBe(100);
  });
});

describe("bills", () => {
  it("sorts by due date and labels relative days", () => {
    const rows = billRows(fixture().bills, "2026-11-11");
    expect(rows.map((r) => r.id)).toEqual(["b3", "b1", "b2", "b4"]);
    expect(relativeDue(rows[1])).toBe("3 days overdue");
    expect(relativeDue(rows[2])).toBe("in 2 days");
    const sum = billsSummary(rows);
    expect(sum.next14).toBe(P(1420));
    expect(sum.overdue.map((b) => b.id)).toEqual(["b1"]);
    expect(sum.next?.id).toBe("b2");
  });
});

describe("chart", () => {
  it("day view: future days are empty and today is marked", () => {
    const d = fixture();
    const c = buildChart("day", d, computeSummary(d), fmt);
    expect(c.bars).toHaveLength(30);
    expect(c.bars[10].today).toBe(true);
    expect(c.bars[11].future).toBe(true);
    expect(c.bars[9].over).toBe(true);
    expect(c.scaleMax).toBe(P(3000));
    expect(c.incomeMarks.map((m) => m.index)).toEqual([0, 4]);
  });
  it("week view covers every day of the month", () => {
    const d = fixture();
    const s = computeSummary(d);
    const c = buildChart("week", d, s, fmt);
    expect(c.bars.map((b) => b.title)).toEqual(["1–7 Nov", "8–14 Nov", "15–21 Nov", "22–28 Nov", "29–30 Nov"]);
    expect(c.bars.reduce((a, b) => a + b.value, 0)).toBe(s.spent);
  });
  it("month view totals 12 months", () => {
    const d = fixture();
    const c = buildChart("month", d, computeSummary(d), fmt);
    expect(c.bars).toHaveLength(12);
    expect(c.total).toBe(P(25000) * 12);
  });
});
