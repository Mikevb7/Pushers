import { BottomNav } from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";
import { themeFor } from "@/lib/themes";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const theme = themeFor(data?.claims?.sub as string | undefined);
  return (
    <div data-theme={theme ?? undefined} className="min-h-dvh">
      <main className="mx-auto max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
