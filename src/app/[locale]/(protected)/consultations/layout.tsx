import type { ReactNode } from "react";

/** Consultations inherit auth from the parent (protected) layout. */
export default function ConsultationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
