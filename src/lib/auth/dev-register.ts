import type { Locale } from "@/i18n/routing";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

interface DevRegisterInput {
  email: string;
  password: string;
  locale: Locale;
}

/** Dev-only: registrace bez odesílání e-mailu (obchází Supabase rate limit) */
export async function devRegisterWithPassword(
  admin: SupabaseClient,
  sessionClient: SupabaseClient,
  input: DevRegisterInput
): Promise<{ ok: true } | { error: string }> {
  const { email, password, locale } = input;

  const existingLogin = await sessionClient.auth.signInWithPassword({
    email,
    password,
  });
  if (!existingLogin.error) return { ok: true };

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { locale },
  });

  if (created.error) {
    const msg = created.error.message.toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered")) {
      return { error: created.error.message };
    }

    const userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      return { error: created.error.message };
    }

    const updated = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      password,
      user_metadata: { locale },
    });
    if (updated.error) {
      return { error: updated.error.message };
    }
  }

  const login = await sessionClient.auth.signInWithPassword({
    email,
    password,
  });
  if (login.error) {
    return { error: login.error.message };
  }

  return { ok: true };
}

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) return null;

    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) return match.id;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

export function canUseDevRegisterBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_DEV_REGISTER === "1" &&
    Boolean(createServiceClient())
  );
}
