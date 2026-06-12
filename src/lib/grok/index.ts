export { chatWithGrok, type GrokMessage, type GrokChatResult } from "./client";
export {
  buildSystemPrompt,
  buildProfileContext,
  parseProfileUpdate,
  stripProfileUpdate,
  mergeProfileUpdate,
} from "./prompts";
export {
  detectConversationStage,
  buildConversationState,
  buildStageContext,
  type ConversationStage,
  type ConversationState,
} from "./conversation";
export {
  assessRecommendationReadiness,
  profileHasCriticalDebt,
  type AnalysisMode,
  type ReadinessAssessment,
} from "./recommendation-readiness";
export { buildEngineContext } from "./prompts";
