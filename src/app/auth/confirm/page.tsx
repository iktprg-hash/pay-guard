import { Suspense } from "react";
import { AuthConfirm } from "@/components/auth/auth-confirm";

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <AuthConfirm />
    </Suspense>
  );
}
