/** Fired after a recommendation is saved locally (install prompt + offline UI) */
export const PWA_RECOMMENDATION_SAVED = "payguard:recommendation-saved";

export function emitRecommendationSaved(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PWA_RECOMMENDATION_SAVED));
}

export function onRecommendationSaved(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PWA_RECOMMENDATION_SAVED, listener);
  return () => window.removeEventListener(PWA_RECOMMENDATION_SAVED, listener);
}
