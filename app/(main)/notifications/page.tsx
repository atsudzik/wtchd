import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarkAllRead } from "@/components/MarkAllRead";
import { FollowButton } from "@/components/FollowButton";

const ACCENT = "#F5A623";

const TYPE_META: Record<string, { emoji: string; iconBg: string; color: string }> = {
  follow:         { emoji: "👤", iconBg: "#4f6d8c", color: "#4f6d8c" },
  watched:        { emoji: "★",  iconBg: "#c8902a", color: "#c8902a" },
  recommendation: { emoji: "🎯", iconBg: ACCENT,    color: ACCENT     },
  comment:        { emoji: "💬", iconBg: "#5ba39a",  color: "#5ba39a"  },
  like:           { emoji: "♥",  iconBg: "#d64545",  color: "#d64545"  },
};

const AVATAR_BG = [
  "linear-gradient(150deg,#3f7e6e,#225447)",
  "linear-gradient(150deg,#c0764b,#7a3c24)",
  "linear-gradient(150deg,#6b6f8c,#26283f)",
  "linear-gradient(150deg,#5ba39a,#235447)",
  "linear-gradient(150deg,#4f6d8c,#26384d)",
  "linear-gradient(150deg,#b0566b,#3a1822)",
];
function avatarBg(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return m <= 1 ? "только что" : `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дня назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

interface Notif {
  id: string;
  type: string;
  tmdb_id: number | null;
  media_type: string | null;
  is_read: boolean;
  created_at: string;
  actor: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  media: {
    title: string;
    poster_path: string | null;
  } | null;
}

function actionText(type: string, mediaTitle: string | null): string {
  switch (type) {
    case "follow":         return "подписался на тебя";
    case "watched":        return `посмотрел «${mediaTitle ?? "фильм"}»`;
    case "recommendation": return `советует тебе «${mediaTitle ?? "фильм"}»`;
    case "comment":        return `прокомментировал «${mediaTitle ?? "фильм"}»`;
    case "like":           return `лайкнул твой отзыв на «${mediaTitle ?? "фильм"}»`;
    default:               return "совершил действие";
  }
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch notifications
  const { data: rawNotifs } = await supabase
    .from("notifications")
    .select("id, type, tmdb_id, media_type, is_read, created_at, actor_id")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const notifs = rawNotifs ?? [];

  // Fetch actor profiles
  const actorIds = [...new Set(notifs.map((n) => n.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length > 0
    ? await supabase.from("users").select("id, username, full_name, avatar_url").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map(actors?.map((a) => [a.id, a]) ?? []);

  // Fetch media titles
  const tmdbIds = [...new Set(notifs.map((n) => n.tmdb_id).filter(Boolean) as number[])];
  const { data: media } = tmdbIds.length > 0
    ? await supabase.from("media_cache").select("tmdb_id, title, poster_path").in("tmdb_id", tmdbIds)
    : { data: [] };
  const mediaMap = new Map(media?.map((m) => [m.tmdb_id, m]) ?? []);

  const enriched: Notif[] = notifs.map((n) => ({
    id: n.id,
    type: n.type,
    tmdb_id: n.tmdb_id,
    media_type: n.media_type,
    is_read: n.is_read,
    created_at: n.created_at,
    actor: actorMap.get(n.actor_id) ?? null,
    media: n.tmdb_id ? (mediaMap.get(n.tmdb_id) ?? null) : null,
  }));

  const unreadCount = enriched.filter((n) => !n.is_read).length;

  return (
    <div className="cc-page" style={{ padding: "0 44px 72px", maxWidth: 720, margin: "0 auto" }}>

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 6,
        background: "linear-gradient(var(--bg) 78%, rgba(var(--bgRGB),0))",
        padding: "28px 0 16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: 30, letterSpacing: "-.03em", lineHeight: 1 }}>Уведомления</h1>
            <p style={{ margin: "6px 0 0", color: "var(--ink4)", fontSize: 14 }}>
              {unreadCount > 0 ? `${unreadCount} непрочитанных` : "Всё прочитано"}
            </p>
          </div>
          {unreadCount > 0 && <MarkAllRead userId={user!.id} />}
        </div>
      </div>

      {/* Empty state */}
      {enriched.length === 0 && (
        <div style={{ textAlign: "center", padding: "72px 0", color: "var(--muted)", fontSize: 15 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.3" strokeLinecap="round" style={{ display: "block", margin: "0 auto 16px" }}>
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10.5 21a1.8 1.8 0 0 0 3 0" />
          </svg>
          Уведомлений пока нет
        </div>
      )}

      {/* Notification list */}
      {enriched.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {enriched.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.watched;
            const actor = n.actor;
            const initial = (actor?.full_name ?? actor?.username ?? "?")[0]?.toUpperCase() ?? "?";
            const posterUrl = n.media?.poster_path
              ? `https://image.tmdb.org/t/p/w92${n.media.poster_path}`
              : null;

            return (
              <div key={n.id} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "14px 16px",
                borderRadius: 16,
                background: n.is_read ? "transparent" : "var(--surface)",
                border: `1px solid ${n.is_read ? "rgba(var(--line),0.06)" : "rgba(var(--line),0.07)"}`,
                transition: "background .12s",
                cursor: "default",
              }}>
                {/* Avatar + type dot */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {actor ? (
                    <Link href={`/${actor.username ?? ""}`} style={{ display: "block", textDecoration: "none" }}>
                      {actor.avatar_url ? (
                        <img src={actor.avatar_url} alt={actor.full_name ?? ""} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: avatarBg(actor.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>
                          {initial}
                        </div>
                      )}
                    </Link>
                  ) : (
                    <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--surface2)" }} />
                  )}
                  <div style={{
                    position: "absolute", right: -2, bottom: -2,
                    width: 18, height: 18, borderRadius: "50%",
                    background: meta.iconBg,
                    border: "2.5px solid var(--bg)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, lineHeight: 1,
                  }}>
                    {meta.emoji}
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, color: "var(--ink)" }}>
                    {actor && (
                      <Link href={`/${actor.username ?? ""}`} style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>
                        {actor.full_name ?? actor.username ?? "Пользователь"}
                      </Link>
                    )}
                    {" "}{actionText(n.type, n.media?.title ?? null)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{relativeTime(n.created_at)}</span>
                    {n.tmdb_id && n.media_type && (
                      <Link href={`/film/${n.media_type}/${n.tmdb_id}`} style={{
                        display: "inline-flex", padding: "2px 8px", borderRadius: 7,
                        background: `color-mix(in srgb, ${meta.iconBg} 10%, var(--surface))`,
                        fontSize: 12, fontWeight: 600, color: meta.color, textDecoration: "none",
                      }}>
                        {n.media?.title ?? "Смотреть"}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Poster or follow button */}
                {n.type === "follow" && actor && (
                  <FollowButton targetUserId={actor.id} initialFollowing={false} />
                )}
                {n.tmdb_id && posterUrl && (
                  <Link href={`/film/${n.media_type}/${n.tmdb_id}`} style={{ display: "block", flexShrink: 0, textDecoration: "none" }}>
                    <div style={{ width: 38, height: 56, borderRadius: 6, overflow: "hidden", background: "var(--surface2)", boxShadow: "0 4px 10px -5px rgba(0,0,0,.45)" }}>
                      <img src={posterUrl} alt={n.media?.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  </Link>
                )}

                {/* Unread dot */}
                {!n.is_read && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, flexShrink: 0, marginTop: 6 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
