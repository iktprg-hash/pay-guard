import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricing");

  const freeFeatures = t.raw("freeFeatures") as string[];
  const proFeatures = t.raw("proFeatures") as string[];

  return (
    <div className="mx-auto max-w-4xl flex-1 px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold">{t("title")}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t("free")}
              <span className="text-2xl font-bold">{t("freePrice")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Badge className="mt-6" variant="secondary">
              {t("currentPlan")}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-primary shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {t("pro")}
                <Badge>{t("pro")}</Badge>
              </span>
              <span className="text-2xl font-bold text-primary">{t("proPrice")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" disabled>
              {t("upgrade")} — brzy
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
