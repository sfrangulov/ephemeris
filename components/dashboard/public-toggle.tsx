"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PublicToggle({
  slug,
  initialPublic,
}: {
  slug: string;
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    startTransition(async () => {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_public: next }),
      });
      if (!r.ok) {
        setIsPublic(!next);
        return;
      }
      router.refresh();
    });
  }

  void slug; // explicit: slug is passed for future per-profile context, currently unused

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="flex items-center gap-2 transition-colors hover:text-foreground disabled:opacity-50"
    >
      <span
        className={`size-[7px] rounded-full ${isPublic ? "bg-success" : "bg-muted-foreground/40"}`}
      />
      profile {isPublic ? "public" : "private"} · toggle
    </button>
  );
}
