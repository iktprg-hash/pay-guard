"use client";

import { useSyncExternalStore } from "react";

function subscribeToVisibility(onStoreChange: () => void) {
  document.addEventListener("visibilitychange", onStoreChange);
  return () => document.removeEventListener("visibilitychange", onStoreChange);
}

function getVisibilitySnapshot() {
  return document.visibilityState === "visible";
}

function getServerVisibilitySnapshot() {
  return true;
}

/** True when the browser tab is visible (SSR-safe). */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeToVisibility,
    getVisibilitySnapshot,
    getServerVisibilitySnapshot
  );
}
