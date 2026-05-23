import Link from "next/link";
import { SignInIcon } from "@phosphor-icons/react/ssr";
import type { Status } from "@/lib/aggregate";
import { AddPackage } from "@/components/dashboard/add-package";
import { UserMenu } from "@/components/layout/user-menu";

export interface SidebarUser {
  login: string;
  name: string;
  isOwner: boolean;
}

export interface SidebarPackage {
  name: string;
  status?: Status;
}

const STATUS_DOT: Record<Status, string> = {
  up: "bg-success",
  dn: "bg-destructive",
  flat: "bg-muted-foreground/50",
};

/**
 * Left navigation rail (236px). Brand mark, tracked-package list with a
 * status dot per row, owner-only add affordance, and a sync indicator above
 * the user block. Nav surface deliberately omitted until routes exist.
 */
export function AppSidebar({
  packages,
  user,
  freshness,
}: {
  packages: SidebarPackage[];
  user: SidebarUser | null;
  freshness?: string;
}) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-border/50 bg-background">
      <div className="flex h-[60px] items-center gap-[9px] px-[18px]">
        <div className="flex size-[22px] items-center justify-center rounded-[5px] bg-primary text-[13px] font-bold text-primary-foreground">
          e
        </div>
        <div className="text-[13px] font-bold lowercase tracking-[0.04em]">
          ephemeris
        </div>
      </div>

      <nav className="flex flex-col px-3 pb-2 pt-3.5">
        <div className="flex items-baseline justify-between px-3 pb-1.5 pt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>tracked</span>
          <span className="mono text-foreground/80">{packages.length}</span>
        </div>
        {packages.map((p) => (
          <a
            key={p.name}
            href={`#pkg-${p.name}`}
            className="flex items-center gap-2.5 truncate rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[p.status ?? "flat"]}`}
            />
            <span className="truncate">{p.name}</span>
          </a>
        ))}
      </nav>

      {user?.isOwner && (
        <>
          <div className="mx-1 my-3 h-px bg-border/50" />
          <AddPackage />
        </>
      )}

      <div className="mt-auto">
        <div className="flex items-center gap-[7px] px-[18px] pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="size-[7px] rounded-full bg-success shadow-[0_0_8px_var(--success)] glow-pulse" />
          {freshness ?? "npm · github"}
        </div>
        {user ? (
          <UserMenu login={user.login} name={user.name} />
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2.5 border-t border-border/50 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <SignInIcon className="size-4" weight="regular" />
            sign in with github
          </Link>
        )}
      </div>
    </aside>
  );
}
