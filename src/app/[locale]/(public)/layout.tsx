import type { ReactNode } from "react";

/** Veřejné stránky — bez server auth gate */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
