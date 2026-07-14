import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActiveClient {
  id: string;
  name: string;
  initials?: string | null;
  color?: string | null;
  logo_url?: string | null;
  channelCount?: number;
}

interface ClientState {
  activeClientId: string | null;
  activeClient: ActiveClient | null;
  setActiveClient: (c: ActiveClient | null) => void;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set) => ({
      activeClientId: null,
      activeClient: null,
      setActiveClient: (c) => set({ activeClient: c, activeClientId: c?.id ?? null }),
    }),
    { name: "elevate-active-client" },
  ),
);
