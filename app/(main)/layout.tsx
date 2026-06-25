import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, unreadResult] = await Promise.all([
    supabase.from("users").select("username, full_name, avatar_url").eq("id", user.id).single(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
  ]);

  const profile = profileResult.data;
  const unreadCount = unreadResult.count ?? 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Sidebar profile={profile} unreadCount={unreadCount} />
      <main className="cc-main" style={{ marginLeft: 84 }}>
        {children}
      </main>
      <BottomNav username={profile?.username ?? null} unreadCount={unreadCount} />
    </div>
  );
}
