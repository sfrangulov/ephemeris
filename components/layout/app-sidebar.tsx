import { LayoutGrid, Activity, Star, Bell, Circle, Plus } from "lucide-react";

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
export function AppSidebar({ packages }: { packages: { name: string }[] }) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-border/50 bg-background">
      <div className="flex h-[60px] items-center gap-[9px] px-[18px]">
        <div className="flex size-[22px] items-center justify-center rounded-[5px] bg-primary text-[13px] font-bold text-white">
          e
        </div>
        <div className="text-[13px] font-bold lowercase tracking-[0.04em]">
          ephemeris
          <small className="block text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            situation center
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

      <div className="mx-1 my-3 h-px bg-border/50" />
      <button className="mx-3 flex items-center justify-center gap-2 rounded-md border border-dashed border-primary/45 bg-primary/[0.06] p-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
        <Plus className="size-3.5" />
        Добавить пакет
      </button>

      <div className="mt-auto">
        <div className="flex items-center gap-[7px] px-[18px] pb-1 text-[10px] text-muted-foreground">
          <span className="size-[7px] rounded-full bg-success shadow-[0_0_8px_var(--success)] glow-pulse" />
          данные npm + GitHub · сегодня
        </div>
        <div className="flex items-center gap-2.5 border-t border-border/50 px-4 py-3">
          <div className="flex size-[26px] items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
            SF
          </div>
          <div className="text-xs font-medium leading-tight">
            Sergei
            <small className="block text-[10px] font-normal text-muted-foreground">
              @sfrangulov
            </small>
          </div>
        </div>
      </div>
    </aside>
  );
}
