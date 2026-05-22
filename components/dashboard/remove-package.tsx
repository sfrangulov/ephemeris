"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Owner-only control to remove a package; lives in the card header. */
export function RemovePackage({ name }: { name: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Убрать пакет ${name} из портфеля?`)) return;
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
      title="Убрать из портфеля"
      className="text-muted-foreground/60 transition-colors hover:text-destructive"
    >
      <X className="size-3.5" />
    </button>
  );
}
