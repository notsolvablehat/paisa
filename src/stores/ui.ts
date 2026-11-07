import { create } from "zustand";
import type { Range } from "@/lib/finance";

export type Mode = "Spend" | "Income" | "Goal contribution" | "Reminder";

export type ModalPrefill = {
  editTxId?: string;
  amount?: number; // paise
  categoryId?: string;
  note?: string;
  date?: string;
  goalId?: string;
};

type UIState = {
  /** YYYY-MM being viewed; null = current month. */
  month: string | null;
  range: Range;
  modal: { open: boolean; mode: Mode; prefill: ModalPrefill; nonce: number };
  goalDialogOpen: boolean;
  /** First-run welcome cards (also opened from the header's help button). */
  welcomeOpen: boolean;
  setMonth: (m: string | null) => void;
  setRange: (r: Range) => void;
  openModal: (mode?: Mode, prefill?: ModalPrefill) => void;
  closeModal: () => void;
  toggleModal: () => void;
  setGoalDialogOpen: (open: boolean) => void;
  setWelcomeOpen: (open: boolean) => void;
  /** Back to a fresh session (sign-in / sign-out). */
  reset: () => void;
};

const initial = {
  month: null,
  range: "day",
  modal: { open: false, mode: "Spend", prefill: {}, nonce: 0 },
  goalDialogOpen: false,
  welcomeOpen: false,
} satisfies Partial<UIState>;

export const useUI = create<UIState>()((set, get) => ({
  ...initial,
  reset: () => set(initial),
  setMonth: (month) => set({ month }),
  setRange: (range) => set({ range }),
  openModal: (mode = "Spend", prefill = {}) =>
    set((s) => ({
      modal: { open: true, mode, prefill, nonce: s.modal.nonce + 1 },
    })),
  closeModal: () => set((s) => ({ modal: { ...s.modal, open: false } })),
  toggleModal: () =>
    get().modal.open ? get().closeModal() : get().openModal(),
  setGoalDialogOpen: (goalDialogOpen) => set({ goalDialogOpen }),
  setWelcomeOpen: (welcomeOpen) => set({ welcomeOpen }),
}));
