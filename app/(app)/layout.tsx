import { AppSidebar } from "@/components/layout/app-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("name")
    .order("name");

  return (
    <div className="flex min-h-screen">
      <AppSidebar packages={packages ?? []} />
      <main className="grid-texture relative min-w-0 flex-1 overflow-auto scroll-thin">
        <div className="relative z-10 mx-auto max-w-[1080px] px-8 pb-16 pt-7">
          {children}
        </div>
      </main>
    </div>
  );
}
