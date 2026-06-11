"use client";

import { useEffect, useState } from "react";

/** Načte subscription tier z /api/auth/tier */
export function useSubscriptionTier() {
  const [pro, setPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/tier", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return { pro: false };
        return (await res.json()) as { pro?: boolean };
      })
      .then((data) => {
        if (!cancelled) setPro(Boolean(data.pro));
      })
      .catch(() => {
        if (!cancelled) setPro(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { pro, loading };
}
