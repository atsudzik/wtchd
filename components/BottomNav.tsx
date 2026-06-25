"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCENT = "#F5A623";

interface Props {
  username: string | null;
  unreadCount: number;
}

export function BottomNav({ username, unreadCount }: Props) {
  const path = usePathname();

  const nav = [
    {
      href: "/feed",
      label: "Главная",
      icon: (a: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? ACCENT : "none"} stroke={a ? ACCENT : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" />
        </svg>
      ),
    },
    {
      href: "/search",
      label: "Поиск",
      icon: (a: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
      ),
    },
    {
      href: "/notifications",
      label: "Уведомления",
      badge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined,
      icon: (a: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? ACCENT : "none"} stroke={a ? ACCENT : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10.5 21a1.8 1.8 0 0 0 3 0" />
        </svg>
      ),
    },
    {
      href: username ? `/${username}` : "/profile",
      label: "Профиль",
      icon: (a: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? ACCENT : "none"} stroke={a ? ACCENT : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="cc-bottom-nav">
      {nav.map(({ href, label, icon, badge }) => {
        const active = path === href || (href !== "/feed" && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "6px 0",
              textDecoration: "none",
              color: active ? ACCENT : "var(--ink3)",
              position: "relative",
            }}
          >
            <span style={{ position: "relative", display: "flex" }}>
              {icon(active)}
              {badge && (
                <span style={{
                  position: "absolute",
                  top: -4,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 8,
                  background: ACCENT,
                  color: "#0b0f1a",
                  fontSize: 9,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}>
                  {badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
