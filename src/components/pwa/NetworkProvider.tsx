"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast-provider";

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
  const t = useTranslations("toast");
  const { push } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    const sync = () => {
      const online = navigator.onLine;
      setIsOnline((prev) => {
        if (mounted.current && online !== prev) {
          push(online ? t("online") : t("offline"), online ? "success" : "default");
        }
        return online;
      });
      if (!navigator.onLine) setWasOffline(true);
      mounted.current = true;
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [push, t]);

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
