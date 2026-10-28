import { create } from 'zustand';

interface UIState {
  // Modal flags
  isAddExpenseModalOpen: boolean;
  isSettleModalOpen: boolean;

  // App state
  currentGroupId: string | null;
  isReadOnly: boolean; // true for observer device

  // Actions
  setCurrentGroup: (id: string | null, readOnly?: boolean) => void;
  openAddExpense: () => void;
  closeAddExpense: () => void;
  openSettle: () => void;
  closeSettle: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isAddExpenseModalOpen: false,
  isSettleModalOpen: false,
  currentGroupId: null,
  isReadOnly: false,

  setCurrentGroup: (id, readOnly = false) =>
    set({ currentGroupId: id, isReadOnly: readOnly }),

  openAddExpense: () => set({ isAddExpenseModalOpen: true }),
  closeAddExpense: () => set({ isAddExpenseModalOpen: false }),
  openSettle: () => set({ isSettleModalOpen: true }),
  closeSettle: () => set({ isSettleModalOpen: false }),
}));
