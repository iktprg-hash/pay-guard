import type { ChatMessage, PrioritizationResult } from "@/lib/types/financial";

/** Last embedded recommendation in a chat session (newest wins). */
export function extractRecommendationFromMessages(
  messages: ChatMessage[]
): PrioritizationResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].recommendation) return messages[i].recommendation!;
  }
  return null;
}
