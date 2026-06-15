export const CUSTOM_CATEGORY_PREFIX = "custom:";

/** Slug for a user-defined category label. */
export function toCustomCategorySlug(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `${CUSTOM_CATEGORY_PREFIX}${slug}` : `${CUSTOM_CATEGORY_PREFIX}other`;
}

export function isCustomCategory(category: string): boolean {
  return category.startsWith(CUSTOM_CATEGORY_PREFIX);
}

export function customCategoryLabel(category: string): string {
  if (!isCustomCategory(category)) return category;
  const raw = category.slice(CUSTOM_CATEGORY_PREFIX.length).replace(/-/g, " ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function isPresetCategory(
  category: string,
  presets: readonly string[]
): category is (typeof presets)[number] {
  return (presets as readonly string[]).includes(category);
}

/** Resolve i18n key suffix for a category slug. */
export function categoryMessageKey(
  namespace: "categories",
  category: string
): string {
  return `${namespace}.${category}`;
}
