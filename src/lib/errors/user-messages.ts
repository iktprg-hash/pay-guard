import type { ErrorCode } from "./codes";
import type { Locale } from "@/i18n/routing";

const messages: Record<Locale, Record<ErrorCode, string>> = {
  cs: {
    UNAUTHORIZED: "Nejste přihlášeni. Prosím přihlaste se.",
    FORBIDDEN: "Nemáte oprávnění k této akci.",
    PRO_REQUIRED: "Tato funkce je dostupná pouze pro uživatele Pro.",
    RATE_LIMITED: "Příliš mnoho požadavků. Zkuste to prosím později.",
    VALIDATION_ERROR: "Zadaná data nejsou platná.",
    CHAT_PROCESSING_FAILED: "Nepodařilo se zpracovat zprávu. Zkuste to prosím znovu.",
    PRIORITIZATION_FAILED: "Nepodařilo se vypočítat doporučení.",
    PDF_GENERATION_FAILED: "Nepodařilo se vygenerovat PDF.",
    STRIPE_ERROR: "Došlo k chybě při platbě. Zkuste to prosím později.",
    NETWORK_ERROR: "Problém s připojením k internetu.",
    INTERNAL_ERROR: "Došlo k neočekávané chybě. Zkuste to prosím později.",
    UNKNOWN_ERROR: "Došlo k neočekávané chybě.",
  },
  ru: {
    UNAUTHORIZED: "Вы не авторизованы. Пожалуйста, войдите в аккаунт.",
    FORBIDDEN: "У вас нет прав для выполнения этого действия.",
    PRO_REQUIRED: "Эта функция доступна только пользователям Pro.",
    RATE_LIMITED: "Слишком много запросов. Пожалуйста, попробуйте позже.",
    VALIDATION_ERROR: "Введённые данные некорректны.",
    CHAT_PROCESSING_FAILED: "Не удалось обработать сообщение. Попробуйте ещё раз.",
    PRIORITIZATION_FAILED: "Не удалось рассчитать рекомендации.",
    PDF_GENERATION_FAILED: "Не удалось сгенерировать PDF.",
    STRIPE_ERROR: "Произошла ошибка при оплате. Попробуйте позже.",
    NETWORK_ERROR: "Проблема с подключением к интернету.",
    INTERNAL_ERROR: "Произошла неожиданная ошибка. Попробуйте позже.",
    UNKNOWN_ERROR: "Произошла неожиданная ошибка.",
  },
  en: {
    UNAUTHORIZED: "You are not logged in. Please sign in.",
    FORBIDDEN: "You don't have permission to perform this action.",
    PRO_REQUIRED: "This feature is available only for Pro users.",
    RATE_LIMITED: "Too many requests. Please try again later.",
    VALIDATION_ERROR: "The provided data is invalid.",
    CHAT_PROCESSING_FAILED: "Failed to process your message. Please try again.",
    PRIORITIZATION_FAILED: "Failed to calculate recommendations.",
    PDF_GENERATION_FAILED: "Failed to generate PDF.",
    STRIPE_ERROR: "An error occurred during payment. Please try again later.",
    NETWORK_ERROR: "Network connection problem.",
    INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
    UNKNOWN_ERROR: "An unexpected error occurred.",
  },
};

/** Localized, user-friendly message for an error code. */
export function getUserErrorMessage(
  code: ErrorCode,
  locale: Locale = "cs"
): string {
  return messages[locale]?.[code] ?? messages.en[code] ?? "An unexpected error occurred.";
}
