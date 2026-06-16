import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay Guard — Chytrý pomocník pro prioritizaci plateb",
  description:
    "Pomáháme občanům ČR rozhodnout, kam poslat omezené peníze, když je závazků hodně.",
};

/** Root layout — required html/body for Next.js 16 (API routes + pages). */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
