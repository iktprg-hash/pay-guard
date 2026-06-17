import type { Locale } from "@/i18n/routing";
import type { AppErrorCode } from "@/lib/errors/codes";
import { isAppErrorCode } from "@/lib/errors/codes";
import { AppErrorImpl, type AppError } from "@/lib/errors/app-error";

function isAppError(error: unknown): error is AppError {
  return error instanceof AppErrorImpl;
}

/** Client-only codes plus all server {@link AppErrorCode} values. */
export type ClientErrorCode = "NETWORK_ERROR" | "UNKNOWN_ERROR";

export type UserErrorCode = AppErrorCode | ClientErrorCode;

export const errorMessages = {
  cs: {
    UNAUTHORIZED:
      "Pro pokračování se prosím přihlaste. Vaše data zůstanou v bezpečí.",
    FORBIDDEN: "K této akci bohužel nemáte oprávnění.",
    PRO_REQUIRED:
      "Tato funkce je součástí Pay Guard Pro. S předplatným získáte cloud, PDF export a další nástroje.",
    RATE_LIMITED:
      "Odeslali jste příliš mnoho požadavků. Dejte nám chvilku a zkuste to znovu.",
    VALIDATION_ERROR:
      "Zkontrolujte prosím vyplněné údaje — některé pole vypadá neúplně nebo nesprávně.",
    BAD_REQUEST: "Požadavek se nepodařilo zpracovat. Zkuste to prosím znovu.",
    NOT_FOUND: "Požadovaný záznam jsme nenašli. Možná byl smazán nebo přesunut.",
    CONFLICT:
      "Akci teď nelze dokončit — stav se mezitím změnil. Obnovte stránku a zkuste znovu.",
    UNPROCESSABLE_ENTITY:
      "Zadané údaje teď nelze použít. Doplňte prosím chybějící informace.",
    CHAT_CONSENT_REQUIRED:
      "Než začnete chatovat, potvrďte prosím souhlas se zpracováním dat pro AI asistenta.",
    CHAT_PROCESSING_FAILED:
      "Odpověď se nepodařila načíst. Zkuste otázku napsat znovu — u důležitých plateb vám pomůžeme krok za krokem.",
    CHAT_SERVICE_UNAVAILABLE:
      "AI chat je dočasně nedostupný. Vaše poslední doporučení máte stále k dispozici.",
    CHAT_UPSTREAM_ERROR:
      "Asistent teď neodpovídá. Po chvíli to zkuste znovu — vaše konzultace zůstává uložená.",
    PRIORITIZATION_INSUFFICIENT_DATA:
      "Pro doporučení potřebujeme vědět, kolik máte k dispozici, a alespoň jeden dluh nebo platbu.",
    PRIORITIZATION_FAILED:
      "Prioritu plateb teď nešlo spočítat. Zkontrolujte údaje a zkuste to znovu — nic se neztratilo.",
    PDF_GENERATION_FAILED:
      "PDF se nepodařilo vytvořit. Zkuste export znovu za chvíli.",
    STRIPE_ERROR:
      "Platbu se nepodařilo dokončit. Zkontrolujte prosím kartu nebo to zkuste později.",
    BILLING_NOT_CONFIGURED:
      "Platby jsou dočasně nedostupné. Zkuste to prosím později.",
    BILLING_ALREADY_PRO: "Máte už aktivní předplatné Pro — další nákup není potřeba.",
    BILLING_EMAIL_REQUIRED:
      "Pro předplatné potřebujeme e-mail k vašemu účtu. Doplňte ho v nastavení.",
    BILLING_NO_CUSTOMER:
      "Fakturační účet jsme nenašli. Nejdřív dokončete nákup Pro.",
    BILLING_CHECKOUT_FAILED:
      "Platbu se nepodařilo spustit. Zkuste to znovu nebo nás kontaktujte.",
    BILLING_SYNC_FAILED:
      "Předplatné se nepodařilo synchronizovat. Zkuste obnovit stav za chvíli.",
    BILLING_CONFIRM_FAILED:
      "Platbu se nepodařilo potvrdit. Pokud peníze odešly, Pro se aktivuje automaticky.",
    SERVICE_UNAVAILABLE:
      "Služba je dočasně nedostupná. Zkuste to prosím za chvíli.",
    INTERNAL_ERROR:
      "Něco se pokazilo na naší straně. Zkuste to znovu — vaše data jsou v pořádku.",
    NETWORK_ERROR:
      "Jste offline nebo je slabé připojení. Připojte se k internetu a zkuste to znovu.",
    UNKNOWN_ERROR:
      "Došlo k neočekávané chybě. Zkuste akci zopakovat — pokud problém přetrvá, napište nám.",
  },
  ru: {
    UNAUTHORIZED:
      "Войдите в аккаунт, чтобы продолжить. Ваши данные останутся под защитой.",
    FORBIDDEN: "К сожалению, у вас нет доступа к этому действию.",
    PRO_REQUIRED:
      "Эта функция доступна в Pay Guard Pro: облако, PDF-отчёты и расширенные инструменты.",
    RATE_LIMITED:
      "Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.",
    VALIDATION_ERROR:
      "Проверьте введённые данные — кажется, какое-то поле заполнено не полностью или неверно.",
    BAD_REQUEST: "Не удалось обработать запрос. Попробуйте ещё раз.",
    NOT_FOUND: "Мы не нашли запрашиваемую запись. Возможно, она была удалена.",
    CONFLICT:
      "Сейчас действие выполнить нельзя — состояние изменилось. Обновите страницу и попробуйте снова.",
    UNPROCESSABLE_ENTITY:
      "Эти данные пока нельзя использовать. Дополните, пожалуйста, недостающую информацию.",
    CHAT_CONSENT_REQUIRED:
      "Перед началом чата подтвердите согласие на обработку данных для AI-ассистента.",
    CHAT_PROCESSING_FAILED:
      "Не удалось получить ответ. Напишите вопрос ещё раз — с важными платежами мы разберёмся шаг за шагом.",
    CHAT_SERVICE_UNAVAILABLE:
      "AI-чат временно недоступен. Последняя рекомендация по-прежнему у вас.",
    CHAT_UPSTREAM_ERROR:
      "Ассистент сейчас не отвечает. Попробуйте через минуту — консультация сохранена.",
    PRIORITIZATION_INSUFFICIENT_DATA:
      "Для рекомендации укажите доступные средства и хотя бы один долг или платёж.",
    PRIORITIZATION_FAILED:
      "Не удалось рассчитать приоритеты платежей. Проверьте данные и попробуйте снова — ничего не потеряно.",
    PDF_GENERATION_FAILED:
      "Не удалось создать PDF. Попробуйте экспорт ещё раз чуть позже.",
    STRIPE_ERROR:
      "Не удалось завершить оплату. Проверьте карту или попробуйте позже.",
    BILLING_NOT_CONFIGURED: "Оплата временно недоступна. Попробуйте позже.",
    BILLING_ALREADY_PRO: "У вас уже есть активная подписка Pro — повторная покупка не нужна.",
    BILLING_EMAIL_REQUIRED:
      "Для подписки нужен email в профиле. Добавьте его в настройках.",
    BILLING_NO_CUSTOMER:
      "Платёжный аккаунт не найден. Сначала оформите покупку Pro.",
    BILLING_CHECKOUT_FAILED:
      "Не удалось начать оплату. Попробуйте снова или напишите нам.",
    BILLING_SYNC_FAILED:
      "Не удалось синхронизировать подписку. Обновите статус через минуту.",
    BILLING_CONFIRM_FAILED:
      "Не удалось подтвердить оплату. Если деньги списались, Pro активируется автоматически.",
    SERVICE_UNAVAILABLE: "Сервис временно недоступен. Попробуйте чуть позже.",
    INTERNAL_ERROR:
      "Что-то пошло не так на нашей стороне. Попробуйте снова — ваши данные в безопасности.",
    NETWORK_ERROR:
      "Нет интернета или связь нестабильна. Подключитесь к сети и попробуйте снова.",
    UNKNOWN_ERROR:
      "Произошла непредвиденная ошибка. Повторите действие — если не поможет, напишите нам.",
  },
  en: {
    UNAUTHORIZED:
      "Please sign in to continue. Your information stays secure.",
    FORBIDDEN: "You don't have permission to do this.",
    PRO_REQUIRED:
      "This feature is part of Pay Guard Pro — cloud sync, PDF export, and more.",
    RATE_LIMITED:
      "Too many requests. Please wait a moment and try again.",
    VALIDATION_ERROR:
      "Please check your entries — something looks incomplete or incorrect.",
    BAD_REQUEST: "We couldn't process that request. Please try again.",
    NOT_FOUND: "We couldn't find what you're looking for. It may have been removed.",
    CONFLICT:
      "This action can't be completed right now because something changed. Refresh and try again.",
    UNPROCESSABLE_ENTITY:
      "We can't use these details yet. Please fill in what's missing.",
    CHAT_CONSENT_REQUIRED:
      "Before chatting, please accept consent for AI data processing.",
    CHAT_PROCESSING_FAILED:
      "We couldn't get a reply. Try your question again — we'll walk through your payments step by step.",
    CHAT_SERVICE_UNAVAILABLE:
      "AI chat is temporarily unavailable. Your last recommendation is still here.",
    CHAT_UPSTREAM_ERROR:
      "The assistant isn't responding right now. Try again in a moment — your session is saved.",
    PRIORITIZATION_INSUFFICIENT_DATA:
      "To recommend payment priorities, we need available funds and at least one debt or bill.",
    PRIORITIZATION_FAILED:
      "We couldn't calculate payment priorities. Check your details and try again — nothing was lost.",
    PDF_GENERATION_FAILED:
      "We couldn't create the PDF. Please try exporting again shortly.",
    STRIPE_ERROR:
      "Payment couldn't be completed. Check your card or try again later.",
    BILLING_NOT_CONFIGURED: "Payments are temporarily unavailable. Please try later.",
    BILLING_ALREADY_PRO: "You already have an active Pro subscription.",
    BILLING_EMAIL_REQUIRED:
      "We need an email on your account for billing. Add one in settings.",
    BILLING_NO_CUSTOMER:
      "No billing account found. Complete a Pro purchase first.",
    BILLING_CHECKOUT_FAILED:
      "Checkout couldn't be started. Please try again.",
    BILLING_SYNC_FAILED:
      "We couldn't sync your subscription. Try refreshing in a moment.",
    BILLING_CONFIRM_FAILED:
      "We couldn't confirm the payment. If you were charged, Pro will activate automatically.",
    SERVICE_UNAVAILABLE: "This service is temporarily unavailable. Please try again soon.",
    INTERNAL_ERROR:
      "Something went wrong on our side. Please try again — your data is safe.",
    NETWORK_ERROR:
      "You're offline or the connection is unstable. Connect to the internet and try again.",
    UNKNOWN_ERROR:
      "Something unexpected happened. Try again — if it keeps happening, let us know.",
  },
} as const satisfies Record<Locale, Record<UserErrorCode, string>>;

const DEFAULT_LOCALE: Locale = "cs";

function resolveLocale(locale: Locale | string | undefined): Locale {
  if (locale === "cs" || locale === "ru" || locale === "en") return locale;
  return DEFAULT_LOCALE;
}

/** Localized, human-friendly message for an error code. */
export function getUserErrorMessage(
  code: UserErrorCode,
  locale: Locale = DEFAULT_LOCALE
): string {
  const lang = resolveLocale(locale);
  const messages = errorMessages[lang] as Record<string, string>;
  return (
    messages[code] ??
    errorMessages[DEFAULT_LOCALE][code] ??
    errorMessages[lang].UNKNOWN_ERROR
  );
}

/** Resolve code from AppError, API string, or unknown failure (client-safe). */
export function resolveUserErrorCode(error: unknown): UserErrorCode {
  if (isAppError(error)) return error.code;

  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "NETWORK_ERROR";
  }

  if (error instanceof Error) {
    if (error.message === "OFFLINE" || error.message === "Failed to fetch") {
      return "NETWORK_ERROR";
    }
    if (isAppErrorCode(error.message)) return error.message;
  }

  if (typeof error === "string" && isAppErrorCode(error)) return error;

  return "UNKNOWN_ERROR";
}

/**
 * Best user-facing message from AppError, API code, or thrown error.
 * Prefers explicit {@link AppError.userMessage} when set.
 */
export function getUserErrorMessageFromError(
  error: unknown,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (isAppError(error) && error.userMessage) {
    return error.userMessage;
  }

  const code = isAppError(error) ? error.code : resolveUserErrorCode(error);
  return getUserErrorMessage(code, locale);
}

export type { AppError };
