import { Card } from "@/components/ui/card";

/**
 * Temporary theme-verification landing. Confirms Blueprint v5 dark tokens,
 * glass-card elevation, Geist Mono tabular numerals, and semantic status colors.
 * Replaced by the real dashboard in milestone M6.
 */
export default function Home() {
  return (
    <main className="grid-texture relative flex flex-1 items-center justify-center p-8">
      <div className="relative z-10 w-full max-w-md">
        <Card className="glass-card border-0 p-6">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            ephemeris · theme check
          </p>
          <div className="mono mt-3 flex items-baseline gap-4">
            <span className="text-3xl font-bold">7 230</span>
            <span className="text-sm text-muted-foreground">dl / нед</span>
          </div>
          <div className="mt-4 flex gap-3 text-xs font-semibold uppercase tracking-wide">
            <span className="text-success">▲ рост</span>
            <span className="text-muted-foreground">— штиль</span>
            <span className="text-destructive">▼ спад</span>
            <span className="text-primary">★ stars</span>
          </div>
        </Card>
      </div>
    </main>
  );
}
