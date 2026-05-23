"use client";

import { useRouter } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

export function UserMenu({ login, name }: { login: string; name: string }) {
  const router = useRouter();
  const initials = (name || login).slice(0, 2).toUpperCase();

  async function signOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 border-t border-border/50 px-4 py-3">
      <div className="flex size-[26px] items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
        {initials}
      </div>
      <div className="min-w-0 text-xs font-medium leading-tight">
        <span className="block truncate">{name || login}</span>
        <small className="block truncate text-[10px] font-normal text-muted-foreground">
          @{login}
        </small>
      </div>
      <button
        onClick={signOut}
        title="Sign out"
        className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
      >
        <SignOutIcon className="size-4" weight="regular" />
      </button>
    </div>
  );
}
