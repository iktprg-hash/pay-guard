import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Chat } from "@/components/chat/Chat";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <Suspense>
        <Chat />
      </Suspense>
    </div>
  );
}
