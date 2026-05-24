"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";

export function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function trigger() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/sync", { method: "POST" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "error");
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-1.5">
      {err && (
        <span className="max-w-[260px] rounded-md bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {err}
        </span>
      )}
      <button
        onClick={trigger}
        disabled={busy}
        title={busy ? "Dispatched — workflow running" : "Trigger sync"}
        className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60"
      >
        <ArrowClockwiseIcon
          className={`size-5 ${busy ? "animate-spin" : ""}`}
          weight="bold"
        />
      </button>
    </div>
  );
}
