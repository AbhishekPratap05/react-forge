import { create, StateCreator } from 'zustand';

interface StoreState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

const storeCreator: StateCreator<StoreState> = (set: any) => ({
  count: 0,
  increment: () => set((state: StoreState) => ({ count: state.count + 1 })),
  decrement: () => set((state: StoreState) => ({ count: state.count - 1 })),
});

export const useStore = create<StoreState>(storeCreator);
