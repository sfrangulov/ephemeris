"use client";

import { useRouter } from "next/navigation";
import { SignOutIcon } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

function initialsOf(source: string): string {
  return source
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({
  login,
  name,
  avatarUrl,
}: {
  login: string;
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const initials = initialsOf(name || login);

  async function signOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={22}
          height={22}
          className="size-[22px] rounded-full bg-muted object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex size-[22px] items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
          {initials}
        </div>
      )}
      <span className="hidden text-xs font-medium leading-tight sm:inline">
        @{login}
      </span>
      <button
        onClick={signOut}
        title="Sign out"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <SignOutIcon className="size-3.5" weight="regular" />
      </button>
    </div>
  );
}
