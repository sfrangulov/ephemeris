"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "@phosphor-icons/react";

/** Owner-only control to remove a package; lives in the card header. */
export function RemovePackage({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Remove ${name} from portfolio?`)) return;
    setBusy(true);
    const res = await fetch("/api/packages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) router.refresh();
    else setBusy(false);
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      title="Remove from portfolio"
      className="text-muted-foreground/60 transition-colors hover:text-destructive"
    >
      <XIcon className="size-3.5" weight="bold" />
    </button>
  );
}
