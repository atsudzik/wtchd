"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCENT = "#F5A623";

interface Profile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export function Sidebar({ profile, unreadCount = 0 }: { profile: Profile | null; unreadCount?: number }) {
  const path = usePathname();

  const nav = [
    {
      href: "/feed",
      label: "Главная",
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
          <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" />
        </svg>
      ),
    },
    {
      href: "/search",
      label: "Поиск",
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      ),
    },
    {
      href: "/notifications",
      label: "Уведомления",
      badge: unreadCount > 0 ? String(unreadCount > 99 ? "99+" : unreadCount) : undefined,
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10.5 21a1.8 1.8 0 0 0 3 0" />
        </svg>
      ),
    },
    {
      href: profile?.username ? `/${profile.username}` : "/profile",
      label: "Профиль",
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
          <circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
        </svg>
      ),
    },
  ];

  const initial = profile?.full_name?.[0] ?? profile?.username?.[0] ?? "?";

  return (
    <aside
      className="cc-rail"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "22px 18px",
        borderRight: "1px solid rgba(var(--line),0.08)",
        background: "var(--surface2)",
        zIndex: 30,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 16px" }}>
        <svg width="32" height="32" viewBox="0 0 100 100" style={{ flex: "none" }}>
          <line x1="33" y1="33" x2="67" y2="67" stroke={ACCENT} strokeWidth="12" strokeLinecap="round" />
          <rect x="15" y="15" width="35" height="35" rx="9" fill={ACCENT} />
          <rect x="50" y="50" width="35" height="35" rx="9" fill={ACCENT} />
        </svg>
        <span className="cc-lbl" style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-.03em" }}>WTCHD</span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {nav.map(({ href, label, icon, badge }) => {
          const active = path === href || (href !== "/feed" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 13,
                padding: "11px 11px",
                borderRadius: 11,
                fontWeight: active ? 700 : 500,
                fontSize: 14.5,
                textDecoration: "none",
                color: active ? ACCENT : "var(--ink3)",
                background: "transparent",
              }}
            >
              {icon}
              <span className="cc-lbl">{label}</span>
              {badge && (
                <span className="cc-lbl" style={{
                  marginLeft: "auto",
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: href === "/notifications" ? ACCENT : `color-mix(in srgb, ${ACCENT} 14%, var(--surface))`,
                  color: href === "/notifications" ? "#17120a" : ACCENT,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 4 }}>
        <Link
          href={profile?.username ? `/${profile.username}` : "/profile"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "9px 6px 9px 0",
            borderRadius: 13,
            textDecoration: "none",
            color: "var(--ink)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? ""}
              style={{ width: 38, height: 38, borderRadius: "50%", flex: "none", objectFit: "cover" }}
            />
          ) : (
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              flex: "none",
              background: "linear-gradient(150deg,#3f7e6e,#225447)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
            }}>
              {initial.toUpperCase()}
            </div>
          )}
          <div className="cc-lbl" style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile?.full_name ?? profile?.username ?? "Профиль"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.2 }}>
              @{profile?.username ?? "—"}
            </div>
          </div>
        </Link>

        {/* Settings gear */}
        <Link
          href="/settings"
          className="cc-rail-gear"
          title="Настройки профиля"
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9,
            textDecoration: "none",
            color: "var(--ink4)",
            flexShrink: 0,
            transition: "color .15s, background .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(var(--line),0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink4)";
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
