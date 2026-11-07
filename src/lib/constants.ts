/** Category set every new account starts with. `budget` (whole rupees) is only used by the demo seed. */
export const DEFAULT_CATEGORIES = [
  { name: "Rent", icon: "ri-home-4-line", color: "#9390A2", budget: 7000 },
  { name: "Food", icon: "ri-restaurant-2-line", color: "#DE7139", budget: 3000 },
  { name: "Groceries", icon: "ri-shopping-basket-2-line", color: "#28A984", budget: 2500 },
  { name: "Transport", icon: "ri-bus-2-line", color: "#2B95DE", budget: 1500 },
  { name: "Shopping", icon: "ri-shopping-bag-3-line", color: "#DE6081", budget: 1500 },
  { name: "Bills", icon: "ri-file-list-3-line", color: "#57534E", budget: 4000 },
  { name: "Entertainment", icon: "ri-film-line", color: "#0E9384", budget: 1000 },
  { name: "Health", icon: "ri-heart-pulse-line", color: "#1D8B52", budget: 2000 },
  { name: "Travel", icon: "ri-plane-line", color: "#33ACFF", budget: 0 },
  { name: "Education", icon: "ri-book-open-line", color: "#64748B", budget: 0 },
  { name: "Subscriptions", icon: "ri-repeat-line", color: "#9E435A", budget: 1200 },
] as const;

/** Demo-seed budgets; new accounts start at zero. */
export const DEFAULT_BUDGETS = { monthly: 30000, daily: 1000, hard: 34000 } as const;

export const INCOME_SOURCES = ["Salary", "Freelance", "Side projects", "Other"] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export const SOURCE_META: Record<IncomeSource, { color: string; icon: string }> = {
  Salary: { color: "#8E8E97", icon: "ri-briefcase-4-line" },
  Freelance: { color: "#E8532F", icon: "ri-pen-nib-line" },
  "Side projects": { color: "#28A984", icon: "ri-flask-line" },
  Other: { color: "#2B95DE", icon: "ri-more-line" },
};

export const RECURRENCES = ["Once", "Monthly", "Yearly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

/** Icons / colours offered when creating a custom category. */
export const CUSTOM_ICONS = [
  "ri-cup-line", "ri-gift-line", "ri-t-shirt-line", "ri-gamepad-line",
  "ri-plant-line", "ri-paint-brush-line", "ri-car-line", "ri-hand-heart-line",
] as const;
export const CUSTOM_COLORS = ["#E8532F", "#DE7139", "#28A984", "#2B95DE", "#DE6081", "#0E9384"] as const;
