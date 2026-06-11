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
