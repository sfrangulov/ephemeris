"use client";

import { useState } from "react";
import {
  CodeIcon,
  ClipboardIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import { Popover } from "@base-ui/react/popover";
import {
  BADGE_THEMES,
  BADGE_VARIANTS,
  buildBadgeMarkdown,
  buildBadgeUrl,
  type BadgeVariant,
} from "@/lib/badge-markdown";
import type { Theme } from "@/lib/badge-pkg";

interface Props {
  origin: string;
  slug: string;
  pkg: string;
}

export function BadgeBuilder({ origin, slug, pkg }: Props) {
  const [variant, setVariant] = useState<BadgeVariant>("card");
  const [theme, setTheme] = useState<Theme>("dark");
  const [copied, setCopied] = useState(false);

  const previewUrl = buildBadgeUrl(origin, slug, pkg, variant, theme);
  const snippet = buildBadgeMarkdown(origin, slug, pkg, variant, theme);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`badge markdown for ${pkg}`}
        onClick={(e) => e.stopPropagation()}
        className="relative z-20 inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[popup-open]:bg-card data-[popup-open]:text-foreground"
      >
        <CodeIcon className="size-3" weight="regular" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className="w-[380px] rounded-[calc(var(--radius)*1.5)] border border-border/60 bg-card p-4 text-[12px] shadow-2xl outline-none">
            <div className="mono flex items-baseline justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="truncate text-foreground/80">{pkg}</span>
              <span>badge</span>
            </div>

            <div className="mt-3 flex min-h-[96px] items-center justify-center rounded border border-border/40 bg-background/40 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={previewUrl}
                src={previewUrl}
                alt={`${pkg} ${variant} badge`}
                className="max-w-full"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <Segment
                label="variant"
                value={variant}
                options={BADGE_VARIANTS}
                onChange={setVariant}
              />
              <Segment
                label="theme"
                value={theme}
                options={BADGE_THEMES}
                onChange={setTheme}
              />
            </div>

            <pre className="mono mt-3 max-h-[64px] overflow-auto rounded border border-border/40 bg-background/40 p-2 text-[10px] leading-snug text-muted-foreground scroll-thin">
              {snippet}
            </pre>

            <button
              type="button"
              onClick={copy}
              className="mono mt-3 inline-flex w-full items-center justify-center gap-2 rounded border border-border/60 bg-card/60 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground/80 transition-colors hover:bg-card hover:text-foreground"
            >
              {copied ? (
                <CheckIcon className="size-3" weight="bold" />
              ) : (
                <ClipboardIcon className="size-3" weight="regular" />
              )}
              {copied ? "copied" : "copy markdown"}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
      <span className="w-[52px] shrink-0 text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-1">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 rounded border px-1.5 py-1 transition-colors ${
                active
                  ? "border-foreground/40 bg-card text-foreground"
                  : "border-border/40 bg-background/30 text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
