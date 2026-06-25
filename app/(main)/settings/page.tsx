import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, full_name, bio, avatar_url, favorite_genres")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  return (
    <div className="cc-page" style={{ padding: "0 40px 64px", maxWidth: 640, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ padding: "32px 0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <Link
            href={profile.username ? `/${profile.username}` : "/feed"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid rgba(var(--line),0.1)",
              color: "var(--ink3)",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 26, letterSpacing: "-.03em" }}>
            Редактирование профиля
          </h1>
        </div>
        <p style={{ margin: "0 0 0 50px", fontSize: 14, color: "var(--muted)" }}>
          Изменения отобразятся на твоей публичной странице
        </p>
      </div>

      <SettingsForm profile={profile} />
    </div>
  );
}
