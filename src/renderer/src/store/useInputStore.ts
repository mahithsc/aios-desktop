import { create } from 'zustand'

type InputStore = {
  value: string
  setValue: (value: string) => void
  clearValue: () => void
}

export const useInputStore = create<InputStore>((set) => ({
  value: '',
  setValue: (value) => set({ value }),
  clearValue: () => set({ value: '' })
}))
