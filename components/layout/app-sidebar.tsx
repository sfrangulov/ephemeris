import Link from "next/link";
import { LayoutGrid, Activity, Star, Bell, Circle, LogIn } from "lucide-react";
import { AddPackage } from "@/components/dashboard/add-package";
import { UserMenu } from "@/components/layout/user-menu";

export interface SidebarUser {
  login: string;
  name: string;
  isOwner: boolean;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  badge?: string;
}

const NAV: NavItem[] = [
  { label: "Обзор", icon: LayoutGrid, active: true },
  { label: "Скачивания", icon: Activity },
  { label: "Звёзды", icon: Star },
  { label: "Алерты", icon: Bell, badge: "скоро" },
];

/**
 * Left navigation rail (236px). Mirrors the validated mockup: wordmark,
 * primary nav with an active-dot marker, the tracked-package list, a dashed
 * add affordance, and a live sync indicator above the user block.
 */
export function AppSidebar({
  packages,
  user,
}: {
  packages: { name: string }[];
  user: SidebarUser | null;
}) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-border/50 bg-background">
      <div className="flex h-[60px] items-center gap-[9px] px-[18px]">
        <div className="flex size-[22px] items-center justify-center rounded-[5px] bg-primary text-[13px] font-bold text-white">
          e
        </div>
        <div className="text-[13px] font-bold lowercase tracking-[0.04em]">
          ephemeris
          <small className="block text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            обсерватория
          </small>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pb-2 pt-3.5">
        {NAV.map(({ label, icon: Icon, active, badge }) => (
          <div
            key={label}
            className={`group relative flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
              active
                ? "text-foreground before:absolute before:left-0 before:top-1/2 before:size-1 before:-translate-y-1/2 before:rounded-full before:bg-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
            {badge && (
              <span className="ml-auto text-[10px] font-semibold text-warning">
                {badge}
              </span>
            )}
          </div>
        ))}

        <div className="mx-1 my-3 h-px bg-border/50" />

        <div className="px-3 pb-1 pt-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Пакеты · {packages.length}
        </div>
        {packages.map((p) => (
          <div
            key={p.name}
            className="flex cursor-pointer items-center gap-2.5 truncate rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Circle className="size-4 shrink-0" />
            <span className="truncate">{p.name}</span>
          </div>
        ))}
      </nav>

      {user?.isOwner && (
        <>
          <div className="mx-1 my-3 h-px bg-border/50" />
          <AddPackage />
        </>
      )}

      <div className="mt-auto">
        <div className="flex items-center gap-[7px] px-[18px] pb-1 text-[10px] text-muted-foreground">
          <span className="size-[7px] rounded-full bg-success shadow-[0_0_8px_var(--success)] glow-pulse" />
          данные npm + GitHub · сегодня
        </div>
        {user ? (
          <UserMenu login={user.login} name={user.name} />
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2.5 border-t border-border/50 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogIn className="size-4" />
            Войти через GitHub
          </Link>
        )}
      </div>
    </aside>
  );
}
