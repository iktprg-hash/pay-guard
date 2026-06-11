import { getTranslations, setRequestLocale } from "next-intl/server";
import { ManualForm } from "@/components/manual/manual-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "manual" });
  return { title: `${t("title")} — Pay Guard` };
}

export default async function ManualPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex-1 px-4 py-8">
      <ManualForm />
    </div>
  );
}
