import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  userId: string | null;
  login: string | null;
  isOwner: boolean;
  fullName: string;
  avatarUrl: string | null;
}

/** Cached per-request authenticated viewer. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  const login = (user?.user_metadata?.user_name as string | undefined) ?? null;
  return {
    userId: user?.id ?? null,
    login,
    isOwner: Boolean(
      process.env.OWNER_USER_ID && user?.id === process.env.OWNER_USER_ID,
    ),
    fullName:
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      login ??
      "",
    avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
  };
});
