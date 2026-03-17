import { create } from "zustand";

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

type SocketStore = {
    connectionState: SocketConnectionState
    setConnectionState: (state: SocketConnectionState) => void
}

export const useSocketStore = create<SocketStore>((set) => ({
    connectionState: 'disconnected',
    setConnectionState: (state) => set({ connectionState: state })
  }))