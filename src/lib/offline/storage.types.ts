import type {
  FinancialProfile,
  PrioritizationResult,
} from "@/lib/types/financial";
import type { StoredChatSession } from "@/lib/chat/storage";

export interface OfflineRecommendationSnapshot {
  locale: string;
  result: PrioritizationResult;
  profile: FinancialProfile;
  savedAt: string;
  source: "chat" | "manual";
}

export interface OfflineSessionSnapshot {
  session: StoredChatSession;
  savedAt: string;
}
