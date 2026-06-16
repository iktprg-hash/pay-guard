"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ProFormField, ProSelect } from "@/components/pro/forms/pro-form-field";
import { Input } from "@/components/ui/input";
import {
  CUSTOM_CATEGORY_PREFIX,
  customCategoryLabel,
  isCustomCategory,
  isPresetCategory,
  toCustomCategorySlug,
} from "@/lib/pro/category-labels";

const CUSTOM_OPTION = "__custom__";

interface ProCategorySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: readonly string[];
  /** i18n namespace with categories.* keys, e.g. pro.incomes */
  translationNamespace: string;
}

/** Preset category dropdown with optional custom label input. */
export function ProCategorySelect({
  id,
  label,
  value,
  onChange,
  presets,
  translationNamespace,
}: ProCategorySelectProps) {
  const t = useTranslations(translationNamespace);
  const tCommon = useTranslations("pro.forms");
  const [mode, setMode] = useState<"preset" | "custom">(
    isCustomCategory(value) ? "custom" : "preset"
  );
  const [customText, setCustomText] = useState(
    isCustomCategory(value) ? customCategoryLabel(value) : ""
  );

  useEffect(() => {
    if (isCustomCategory(value)) {
      setMode("custom");
      setCustomText(customCategoryLabel(value));
    } else if (isPresetCategory(value, presets)) {
      setMode("preset");
    }
  }, [value, presets]);

  const options = [
    ...presets.map((preset) => ({
      value: preset,
      label: t(`categories.${preset}` as "categories.other"),
    })),
    { value: CUSTOM_OPTION, label: tCommon("customCategory") },
  ];

  return (
    <div className="space-y-3">
      <ProFormField label={label} htmlFor={id}>
        <ProSelect
          id={id}
          value={mode === "custom" ? CUSTOM_OPTION : value}
          options={options}
          onChange={(e) => {
            const next = e.target.value;
            if (next === CUSTOM_OPTION) {
              setMode("custom");
              if (customText.trim()) {
                onChange(toCustomCategorySlug(customText));
              }
            } else {
              setMode("preset");
              onChange(next);
            }
          }}
        />
      </ProFormField>

      {mode === "custom" && (
        <ProFormField label={tCommon("customCategoryName")} htmlFor={`${id}-custom`}>
          <Input
            id={`${id}-custom`}
            value={customText}
            onChange={(e) => {
              const text = e.target.value;
              setCustomText(text);
              if (text.trim()) {
                onChange(toCustomCategorySlug(text));
              }
            }}
            placeholder={tCommon("customCategoryPlaceholder")}
            required
          />
        </ProFormField>
      )}
    </div>
  );
}

/** Display label for preset or custom category slug. */
export function useCategoryDisplayLabel(
  translationNamespace: string,
  presets: readonly string[]
) {
  const t = useTranslations(translationNamespace);

  return (category: string) => {
    if (isPresetCategory(category, presets)) {
      return t(`categories.${category}` as "categories.other");
    }
    if (isCustomCategory(category)) {
      return customCategoryLabel(category);
    }
    return (category as string).replace(/-/g, " ");
  };
}

export { CUSTOM_CATEGORY_PREFIX };
