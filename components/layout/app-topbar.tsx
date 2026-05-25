import Link from "next/link";
import { SignInIcon } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";

export interface TopbarUser {
  login: string;
  name: string;
  avatarUrl: string | null;
  isOwner: boolean;
}

export function AppTopbar({
  user,
  freshness,
}: {
  user: TopbarUser | null;
  freshness?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-5 border-b border-border/50 bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Logo className="text-[22px] text-foreground" />

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden items-center gap-[7px] text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
          <span className="size-[7px] rounded-full bg-success shadow-[0_0_8px_var(--success)] glow-pulse" />
          {freshness ?? "npm · github"}
        </div>
        {user ? (
          <UserMenu
            login={user.login}
            name={user.name}
            avatarUrl={user.avatarUrl}
          />
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SignInIcon className="size-4" weight="regular" />
            sign in
          </Link>
        )}
      </div>
    </header>
  );
}
