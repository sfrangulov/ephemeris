"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setLoading(false);
  }

  return (
    <main className="grid-texture relative flex min-h-screen items-center justify-center p-8">
      <div className="glass-card relative z-10 w-full max-w-sm p-7">
        <div className="flex items-center gap-[9px]">
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

        <h1 className="mt-6 text-lg">Вход</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Войдите через GitHub, чтобы вести свой портфель пакетов.
        </p>

        <button
          onClick={signIn}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <GithubMark className="size-4" />
          {loading ? "Перенаправление…" : "Войти через GitHub"}
        </button>
      </div>
    </main>
  );
}
