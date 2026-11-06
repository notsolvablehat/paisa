import type { IncomeSource, Recurrence } from "./constants";

/** Everything below is in paise; dates are YYYY-MM-DD; months are YYYY-MM. */

export type Category = { id: string; name: string; icon: string; color: string; budget: number };
export type Txn = { id: string; categoryId: string; amount: number; note: string; date: string; billId: string | null };
export type Income = { id: string; source: IncomeSource; amount: number; note: string; date: string };
export type Goal = {
  id: string;
  name: string;
  target: number;
  monthly: number;
  assigned: number;
  /** Contributed during the viewed month. */
  contributedInMonth: number;
};
export type Bill = {
  id: string;
  name: string;
  amount: number;
  dueOn: string;
  recurrence: Recurrence;
  categoryId: string;
  paid: boolean;
};

export type DashboardData = {
  today: string;
  month: string;
  settings: { monthlyBudget: number; dailyBudget: number; hardLimit: number };
  /** Real balance as of today. */
  balance: number;
  categories: Category[];
  transactions: Txn[]; // in the viewed month
  income: Income[]; // in the viewed month
  recentIncome: Income[]; // latest 5 up to the end of the viewed month
  goals: Goal[];
  bills: Bill[];
  history: {
    /** 12 months ending with the viewed month, oldest first. */
    months: { month: string; spent: number; income: number }[];
    /** 3 years ending with the viewed month's year, oldest first. */
    years: { year: number; spent: number; income: number }[];
    /** 6 months ending with the viewed month, oldest first. */
    incomeBySource: { month: string; bySource: Record<IncomeSource, number> }[];
  };
};
