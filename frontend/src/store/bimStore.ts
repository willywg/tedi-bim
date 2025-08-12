import { create } from 'zustand'

export type ExpressID = number

interface BimState {
  selectedElementId: ExpressID | null
  setSelectedElementId: (id: ExpressID | null) => void
  // Future: cache for properties/quantities per element
  propertiesById: Record<string, unknown>
  setPropertiesForId: (id: ExpressID, props: unknown) => void
  quantitiesById: Record<string, unknown>
  setQuantitiesForId: (id: ExpressID, qty: unknown) => void
  // Budget slice
  budgetItems: BudgetItem[]
  addBudgetItem: (item: BudgetItem) => void
  removeBudgetItem: (id: string) => void
  clearBudget: () => void
  updateBudgetItem: (id: string, patch: Partial<BudgetItem>) => void
}

type Setter<T> = (
  partial: Partial<T> | ((state: T) => Partial<T>),
  replace?: boolean,
) => void

export const useBimStore = create<BimState>((set: Setter<BimState>) => ({
  selectedElementId: null,
  setSelectedElementId: (id: ExpressID | null) => set({ selectedElementId: id }),
  propertiesById: {},
  setPropertiesForId: (id: ExpressID, props: unknown) =>
    set((s: BimState) => ({ propertiesById: { ...s.propertiesById, [String(id)]: props } })),
  quantitiesById: {},
  setQuantitiesForId: (id: ExpressID, qty: unknown) =>
    set((s: BimState) => ({ quantitiesById: { ...s.quantitiesById, [String(id)]: qty } })),
  budgetItems: [],
  addBudgetItem: (item: BudgetItem) =>
    set((s: BimState) => ({ budgetItems: [...s.budgetItems, item] })),
  removeBudgetItem: (id: string) =>
    set((s: BimState) => ({ budgetItems: s.budgetItems.filter((it) => it.id !== id) })),
  clearBudget: () => set({ budgetItems: [] }),
  updateBudgetItem: (id: string, patch: Partial<BudgetItem>) =>
    set((s: BimState) => ({
      budgetItems: s.budgetItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    })),
}))

export interface BudgetItem {
  id: string // unique id for UI list
  expressId: ExpressID
  name: string
  type?: string
  qtyName?: string
  qtyValue?: number
  unit?: string
  unitPrice?: number
}
