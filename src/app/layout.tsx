import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Pay Guard — Chytrý pomocník pro prioritizaci plateb",
  description:
    "Pomáháme občanům ČR rozhodnout, kam poslat omezené peníze, když je závazků hodně.",
};

/** Root layout — required html/body for Next.js 16 (API routes + pages). */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html suppressHydrationWarning nonce={nonce}>
      <body suppressHydrationWarning nonce={nonce}>
        {children}
      </body>
    </html>
  );
}
