"use client";

import { useState } from "react";
import { ClipboardIcon, CheckIcon } from "@phosphor-icons/react";

export function CopyBadge({ origin, slug }: { origin: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `[![ephemeris](${origin}/badge/${slug})](${origin}/u/${slug})`;

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 transition-colors hover:text-foreground"
    >
      {copied ? (
        <CheckIcon className="size-3" weight="bold" />
      ) : (
        <ClipboardIcon className="size-3" weight="regular" />
      )}
      {copied ? "copied" : "copy badge markdown"}
    </button>
  );
}
