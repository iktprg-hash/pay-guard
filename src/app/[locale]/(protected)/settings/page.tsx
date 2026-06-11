import { setRequestLocale } from "next-intl/server";
import { SettingsPanel } from "@/components/pwa/SettingsPanel";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <SettingsPanel />
    </div>
  );
}
