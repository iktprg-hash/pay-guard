"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface NetworkContextValue {
  isOnline: boolean;
  wasOffline: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  wasOffline: false,
});

export function useNetworkStatus() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const sync = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) setWasOffline(true);
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const value = useMemo(
    () => ({ isOnline, wasOffline }),
    [isOnline, wasOffline]
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

/** Hook pro API volání s offline detekcí */
export function useOfflineAwareFetch() {
  const { isOnline } = useNetworkStatus();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isOnline) {
        throw new Error("OFFLINE");
      }
      return fetch(input, init);
    },
    [isOnline]
  );
}
