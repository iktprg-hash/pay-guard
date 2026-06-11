/**
 * @deprecated Použijte přímo @/services/priorityEngine
 * Tento soubor zachovává zpětnou kompatibilitu.
 */
export {
  runPriorityEngine as prioritizePayments,
  runPriorityEngine,
  analyzeDebt,
  calculateLifeBufferPercent,
  buildExplanation,
  daysBetween,
} from "@/services/priorityEngine";
