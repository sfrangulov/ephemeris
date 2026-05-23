"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";

/** Owner-only inline control to add a package to the portfolio. */
export function AddPackage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json.error ?? "error");
      setBusy(false);
      return;
    }
    setName("");
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-3 flex items-center justify-center gap-2 rounded-md border border-dashed border-primary/45 bg-primary/[0.06] p-2 text-xs font-semibold text-primary transition-[background-color,transform] duration-200 hover:bg-primary/10 active:scale-[0.98]"
      >
        <PlusIcon className="size-3.5" weight="bold" />
        Add package
      </button>
    );
  }

  return (
    <div className="mx-3 flex flex-col gap-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="npm package name"
        className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary"
      />
      {err && (
        <span className="flex items-center gap-1 rounded-sm bg-destructive/10 px-1.5 py-1 text-[10px] text-destructive">
          <WarningCircleIcon className="size-3 shrink-0" weight="fill" />
          {err}
        </span>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={add}
          disabled={busy}
          className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-white transition-transform duration-150 disabled:opacity-60 active:scale-[0.98]"
        >
          {busy ? "…" : "Add"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-transform duration-150 active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
