import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay Guard — Chytrý pomocník pro prioritizaci plateb",
  description:
    "Pomáháme občanům ČR rozhodnout, kam poslat omezené peníze, když je závazků hodně.",
};

/** Root layout — locale-specific layout je v [locale]/layout.tsx */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
