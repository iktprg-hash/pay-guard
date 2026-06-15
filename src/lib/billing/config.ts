/** Czech market Pro subscription — configure Price in Stripe Dashboard (CZK / month). */
export function isStripeBillingConfigured(): boolean {
  return Boolean(getStripeSecretKey() && getStripeProPriceId());
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

export function getStripeSecretKey(): string | undefined {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || key.includes("sk_test_xxx") || key.includes("sk_live_xxx")) {
    return undefined;
  }
  return key;
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
