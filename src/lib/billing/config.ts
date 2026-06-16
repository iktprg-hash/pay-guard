/** Czech market Pro subscription — configure Price in Stripe Dashboard (CZK / month). */

export type StripeBillingConfigIssue =
  | "missing_secret_key"
  | "placeholder_secret_key"
  | "invalid_secret_key"
  | "missing_price_id"
  | "placeholder_price_id"
  | "invalid_price_id"
  | "product_id_not_price"
  | "missing_webhook_secret";

export interface StripeBillingConfigStatus {
  /** Checkout + portal API can run (secret key + price id). */
  checkoutEnabled: boolean;
  /** Webhook signing secret for post-payment activation. */
  webhookConfigured: boolean;
  testMode: boolean;
  issues: StripeBillingConfigIssue[];
  /** Primary blocker for checkout (first in priority order). */
  checkoutBlocker: StripeBillingConfigIssue | null;
}

const CHECKOUT_BLOCKER_ORDER: StripeBillingConfigIssue[] = [
  "missing_secret_key",
  "placeholder_secret_key",
  "invalid_secret_key",
  "missing_price_id",
  "placeholder_price_id",
  "product_id_not_price",
  "invalid_price_id",
];

/** Human-readable server/API message for a billing config issue. */
export function describeStripeBillingIssue(issue: StripeBillingConfigIssue): string {
  switch (issue) {
    case "missing_secret_key":
      return "STRIPE_SECRET_KEY is not set";
    case "placeholder_secret_key":
      return "STRIPE_SECRET_KEY is still a placeholder — add your sk_test_ or sk_live_ key";
    case "invalid_secret_key":
      return "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_";
    case "missing_price_id":
      return "STRIPE_PRO_PRICE_ID is not set";
    case "placeholder_price_id":
      return "STRIPE_PRO_PRICE_ID is still a placeholder — use a Price id (price_…)";
    case "product_id_not_price":
      return "STRIPE_PRO_PRICE_ID must be a Price id (price_…), not a Product id (prod_…)";
    case "invalid_price_id":
      return "STRIPE_PRO_PRICE_ID must start with price_";
    case "missing_webhook_secret":
      return "STRIPE_WEBHOOK_SECRET is not set — checkout works but Pro won't activate after payment";
    default:
      return "Stripe billing is not configured";
  }
}

function isPlaceholderSecret(value: string | undefined): boolean {
  return !value || value.includes("whsec_xxx");
}

function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key || key.includes("sk_test_xxx") || key.includes("sk_live_xxx")) {
    return true;
  }
  return key.startsWith("sk_test_");
}

export function getStripeSecretKeyIssue():
  | "missing"
  | "placeholder"
  | "invalid_format"
  | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "missing";
  if (key.includes("sk_test_xxx") || key.includes("sk_live_xxx")) return "placeholder";
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    return "invalid_format";
  }
  return null;
}

export function getStripeSecretKey(): string | undefined {
  if (getStripeSecretKeyIssue()) return undefined;
  return process.env.STRIPE_SECRET_KEY?.trim();
}

/**
 * Webhook signing secret aligned with STRIPE_SECRET_KEY mode.
 * Prefer STRIPE_WEBHOOK_SECRET_TEST / _LIVE; STRIPE_WEBHOOK_SECRET is fallback.
 */
export function getStripeWebhookSecret(): string | undefined {
  const legacy = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const test = process.env.STRIPE_WEBHOOK_SECRET_TEST?.trim();
  const live = process.env.STRIPE_WEBHOOK_SECRET_LIVE?.trim();

  if (isStripeTestMode()) {
    if (!isPlaceholderSecret(test)) return test;
    if (!isPlaceholderSecret(legacy)) return legacy;
    return undefined;
  }

  if (!isPlaceholderSecret(live)) return live;
  if (!isPlaceholderSecret(legacy)) return legacy;
  return undefined;
}

/** Stripe Price id for Pay Guard Pro (CZK monthly) — Czech market */
export function getStripeProPriceId(): string | undefined {
  const id = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (!id || id.includes("price_xxx")) return undefined;
  if (id.startsWith("prod_")) return undefined;
  if (!id.startsWith("price_")) return undefined;
  return id;
}

export function getStripeProPriceIdIssue(): string | null {
  const id = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (!id) return "missing";
  if (id.includes("price_xxx")) return "placeholder";
  if (id.startsWith("prod_")) return "product_id_not_price";
  if (!id.startsWith("price_")) return "invalid_format";
  return null;
}

export function getStripePublishableKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!key || key.includes("pk_test_xxx")) return undefined;
  return key;
}

/** Detailed Stripe billing readiness for pricing UI and ops checklists. */
export function getStripeBillingConfigStatus(): StripeBillingConfigStatus {
  const issues: StripeBillingConfigIssue[] = [];

  const secretIssue = getStripeSecretKeyIssue();
  if (secretIssue === "missing") issues.push("missing_secret_key");
  else if (secretIssue === "placeholder") issues.push("placeholder_secret_key");
  else if (secretIssue === "invalid_format") issues.push("invalid_secret_key");

  const priceIssue = getStripeProPriceIdIssue();
  if (priceIssue === "missing") issues.push("missing_price_id");
  else if (priceIssue === "placeholder") issues.push("placeholder_price_id");
  else if (priceIssue === "product_id_not_price") issues.push("product_id_not_price");
  else if (priceIssue === "invalid_format") issues.push("invalid_price_id");

  if (!getStripeWebhookSecret()) {
    issues.push("missing_webhook_secret");
  }

  const checkoutBlocker =
    CHECKOUT_BLOCKER_ORDER.find((issue) => issues.includes(issue)) ?? null;

  return {
    checkoutEnabled: checkoutBlocker === null,
    webhookConfigured: !issues.includes("missing_webhook_secret"),
    testMode: isStripeTestMode(),
    issues,
    checkoutBlocker,
  };
}

/** True when Checkout + Customer Portal can be created. */
export function isStripeBillingConfigured(): boolean {
  return getStripeBillingConfigStatus().checkoutEnabled;
}
