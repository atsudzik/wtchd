import { createClient } from "@/lib/supabase/server";
import { fetchMediaDetail } from "@/lib/tmdb";
import Link from "next/link";

const ACCENT = "#F5A623";

const AVATAR_BG = [
  "linear-gradient(150deg,#3f7e6e,#225447)",
  "linear-gradient(150deg,#c0764b,#7a3c24)",
  "linear-gradient(150deg,#6b6f8c,#26283f)",
  "linear-gradient(150deg,#5ba39a,#235447)",
  "linear-gradient(150deg,#4f6d8c,#26384d)",
  "linear-gradient(150deg,#b0566b,#3a1822)",
];
function avatarBg(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffffff;
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
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

function actionText(status: string, rating: number | null, mediaType: string): string {
  const type = mediaType === "tv" ? "сериал" : "фильм";
  if (status === "watched") {
    if (rating) return `посмотрел${rating >= 8 ? " и в восторге 🎉" : ""} — оценил на ${rating}/10`;
    return "посмотрел";
  }
  if (status === "watching") return `начал смотреть`;
  return `добавил в «хочу посмотреть»`;
}

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("username, full_name")
    .eq("id", user!.id)
    .single();

  // Who the user follows
  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user!.id);

  const followingIds = following?.map((f) => f.following_id) ?? [];
  const hasFollowing = followingIds.length > 0;

  // Friends' recent activity
  let activityItems: FeedItem[] = [];

  if (hasFollowing) {
    const { data: activity } = await supabase
      .from("watched")
      .select("user_id, tmdb_id, media_type, status, rating, watched_at, created_at")
      .in("user_id", followingIds)
      .not("status", "eq", "want") // don't show want-list in feed, only watched/watching
      .order("watched_at", { ascending: false })
      .limit(40);

    if (activity && activity.length > 0) {
      const actorIds = [...new Set(activity.map((a) => a.user_id))];
      const tmdbIds = [...new Set(activity.map((a) => a.tmdb_id))];

      const [actorsResult, mediaResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, full_name, avatar_url")
          .in("id", actorIds),
        supabase
          .from("media_cache")
          .select("tmdb_id, title, poster_path, release_date, genres")
          .in("tmdb_id", tmdbIds),
      ]);

      const actorMap = new Map(actorsResult.data?.map((u) => [u.id, u]) ?? []);
      const mediaMap = new Map(mediaResult.data?.map((m) => [m.tmdb_id, m]) ?? []);

      // Backfill any tmdb_ids missing from cache
      const uniqueItems = [...new Map(activity.map((a) => [`${a.media_type}:${a.tmdb_id}`, a])).values()];
      const missing = uniqueItems.filter((a) => !mediaMap.has(a.tmdb_id));
      if (missing.length > 0) {
        const fetched = await Promise.allSettled(
          missing.map((a) => fetchMediaDetail(a.media_type as "movie" | "tv", a.tmdb_id))
        );
        const toUpsert: object[] = [];
        fetched.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            const d = result.value;
            mediaMap.set(d.tmdb_id, {
              tmdb_id: d.tmdb_id,
              title: d.title,
              poster_path: d.poster_path,
              release_date: d.release_date,
              genres: d.genres,
            });
            toUpsert.push({
              tmdb_id: d.tmdb_id,
              media_type: d.media_type,
              title: d.title,
              original_title: d.original_title,
              poster_path: d.poster_path,
              overview: d.overview,
              release_date: d.release_date,
              genres: d.genres,
              runtime: d.runtime,
              countries: d.countries,
              cast_main: d.cast_main,
              cached_at: new Date().toISOString(),
            });
          }
        });
        if (toUpsert.length > 0) {
          await supabase.from("media_cache").upsert(toUpsert, { onConflict: "tmdb_id" });
        }
      }

      activityItems = activity.map((a) => {
        const actor = actorMap.get(a.user_id);
        const media = mediaMap.get(a.tmdb_id);
        return {
          userId: a.user_id,
          tmdbId: a.tmdb_id,
          mediaType: a.media_type,
          status: a.status,
          rating: a.rating,
          timestamp: a.watched_at ?? a.created_at,
          username: actor?.username ?? "unknown",
          fullName: actor?.full_name ?? actor?.username ?? "Пользователь",
          avatarUrl: actor?.avatar_url ?? null,
          title: media?.title ?? `#${a.tmdb_id}`,
          posterPath: media?.poster_path ?? null,
          genres: (media?.genres as string[]) ?? [],
        };
      });
    }
  }

  // Also show own recent watched
  const { data: ownWatched } = await supabase
    .from("watched")
    .select("tmdb_id, media_type, status, rating, watched_at")
    .eq("user_id", user!.id)
    .order("watched_at", { ascending: false })
    .limit(8);

  const ownTmdbIds = ownWatched?.map((w) => w.tmdb_id) ?? [];
  let ownMediaMap = new Map<number, { title: string; poster_path: string | null }>();

  if (ownTmdbIds.length > 0) {
    const { data: ownMedia } = await supabase
      .from("media_cache")
      .select("tmdb_id, title, poster_path, release_date")
      .in("tmdb_id", ownTmdbIds);

    for (const m of ownMedia ?? []) ownMediaMap.set(m.tmdb_id, m);

    // Backfill missing own-watched entries
    const ownMissing = (ownWatched ?? []).filter((w) => !ownMediaMap.has(w.tmdb_id));
    if (ownMissing.length > 0) {
      const fetched = await Promise.allSettled(
        ownMissing.map((w) => fetchMediaDetail(w.media_type as "movie" | "tv", w.tmdb_id))
      );
      const toUpsert: object[] = [];
      fetched.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          const d = result.value;
          ownMediaMap.set(d.tmdb_id, { title: d.title, poster_path: d.poster_path });
          toUpsert.push({
            tmdb_id: d.tmdb_id,
            media_type: d.media_type,
            title: d.title,
            original_title: d.original_title,
            poster_path: d.poster_path,
            overview: d.overview,
            release_date: d.release_date,
            genres: d.genres,
            runtime: d.runtime,
            countries: d.countries,
            cast_main: d.cast_main,
            cached_at: new Date().toISOString(),
          });
        }
      });
      if (toUpsert.length > 0) {
        await supabase.from("media_cache").upsert(toUpsert, { onConflict: "tmdb_id" });
      }
    }
  }

  return (
    <div className="cc-page" style={{ padding: "0 40px 64px", maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "18px 24px", flexWrap: "wrap", padding: "26px 0 18px" }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 30, letterSpacing: "-.03em", lineHeight: 1 }}>Лента друзей</h1>
          <p style={{ margin: "7px 0 0", color: "var(--ink4)", fontSize: 14 }}>Кинопамять твоей компании</p>
        </div>
        <Link href="/search" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 18px", borderRadius: 11, border: "none",
          background: ACCENT, color: "#0b0f1a",
          fontFamily: "inherit", fontWeight: 700, fontSize: 14, textDecoration: "none",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Найти фильм
        </Link>
      </header>

      {/* Activity feed */}
      {activityItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 48 }}>
          {activityItems.map((item, i) => (
            <FeedCard key={`${item.userId}-${item.tmdbId}-${i}`} item={item} />
          ))}
        </div>
      )}

      {/* Empty state (no friends) */}
      {!hasFollowing && (
        <EmptyFeed />
      )}

      {/* If has following but no activity yet */}
      {hasFollowing && activityItems.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)", fontSize: 15 }}>
          Друзья пока ничего не смотрели — скоро появится активность
        </div>
      )}

      {/* Own recent activity */}
      {ownWatched && ownWatched.length > 0 && (
        <section>
          <h2 style={{ margin: "0 0 18px", fontWeight: 700, fontSize: 19, letterSpacing: "-.01em" }}>
            Ты недавно смотрел
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 14 }}>
            {ownWatched.map((w) => {
              const m = ownMediaMap.get(w.tmdb_id);
              return (
                <Link key={`${w.tmdb_id}-${w.media_type}`} href={`/film/${w.media_type}/${w.tmdb_id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  <div style={{
                    aspectRatio: "2/3", borderRadius: 10, overflow: "hidden",
                    background: m?.poster_path ? "var(--surface2)" : "var(--surface)",
                    boxShadow: "0 6px 18px -10px rgba(0,0,0,.4)",
                    position: "relative",
                  }}>
                    {m?.poster_path && (
                      <img src={`https://image.tmdb.org/t/p/w342${m.poster_path}`} alt={m.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    {w.rating && (
                      <div style={{ position: "absolute", bottom: 7, right: 7, background: ACCENT, color: "#0b0f1a", fontWeight: 800, fontSize: 11, borderRadius: 6, padding: "2px 6px" }}>
                        {w.rating}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, lineHeight: 1.2, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m?.title ?? `#${w.tmdb_id}`}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface FeedItem {
  userId: string;
  tmdbId: number;
  mediaType: string;
  status: string;
  rating: number | null;
  timestamp: string | null;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  title: string;
  posterPath: string | null;
  genres: string[];
}

// ── Feed card ─────────────────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  const initial = item.fullName[0]?.toUpperCase() ?? "?";
  const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w185${item.posterPath}` : null;
  const genreLabel = item.genres[0] ?? (item.mediaType === "tv" ? "Сериал" : "Фильм");

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      padding: "16px 18px",
      borderRadius: 16,
      background: "var(--surface)",
      border: "1px solid rgba(var(--line),0.07)",
      boxShadow: "0 1px 2px rgba(var(--line),0.04)",
    }}>
      {/* Avatar */}
      <Link href={`/${item.username}`} style={{ display: "block", flexShrink: 0, textDecoration: "none" }}>
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt={item.fullName} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: avatarBg(item.userId),
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 18,
          }}>
            {initial}
          </div>
        )}
      </Link>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, color: "var(--ink)" }}>
          <Link href={`/${item.username}`} style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}>{item.fullName}</Link>
          {" "}{actionText(item.status, item.rating, item.mediaType)}{" "}
          <Link href={`/film/${item.mediaType}/${item.tmdbId}`} style={{ fontWeight: 700, textDecoration: "none", color: "var(--ink)" }}>
            «{item.title}»
          </Link>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{relativeTime(item.timestamp)}</span>
          {genreLabel && (
            <span style={{
              display: "inline-flex", padding: "2px 8px", borderRadius: 7,
              background: "rgba(var(--line),0.06)",
              fontSize: 12, fontWeight: 600, color: "var(--ink4)",
            }}>
              {genreLabel}
            </span>
          )}
          {item.rating && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 8px", borderRadius: 7,
              background: `color-mix(in srgb, ${ACCENT} 14%, var(--surface))`,
              fontSize: 12, fontWeight: 700, color: ACCENT,
            }}>
              ★ {item.rating}/10
            </span>
          )}
        </div>
      </div>

      {/* Poster thumbnail */}
      <Link href={`/film/${item.mediaType}/${item.tmdbId}`} style={{ display: "block", flexShrink: 0, textDecoration: "none" }}>
        <div style={{
          width: 42, height: 62, borderRadius: 7,
          overflow: "hidden",
          background: posterUrl ? "var(--surface2)" : "var(--surface)",
          boxShadow: "0 4px 10px -5px rgba(0,0,0,.45)",
        }}>
          {posterUrl && (
            <img src={posterUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      </Link>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "64px 32px 80px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 40, height: 148 }}>
        <div style={{ width: 88, height: 132, borderRadius: 13, background: "linear-gradient(158deg,#5b7a99,#162636)", boxShadow: "0 16px 32px -16px rgba(0,0,0,.4)", transform: "rotate(-9deg) translateX(14px)" }} />
        <div style={{ width: 96, height: 144, borderRadius: 13, background: "linear-gradient(158deg,#d9a05b,#5e2f1c)", boxShadow: "0 20px 40px -18px rgba(0,0,0,.55)", zIndex: 2, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(116deg,rgba(255,255,255,.06) 0 1.5px,transparent 1.5px 9px)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.5) 0%,transparent 55%)" }} />
          <svg style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)" }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
          </svg>
        </div>
        <div style={{ width: 88, height: 132, borderRadius: 13, background: "linear-gradient(150deg,#4bb3a6,#3a2a5c)", boxShadow: "0 16px 32px -16px rgba(0,0,0,.4)", transform: "rotate(9deg) translateX(-14px)" }} />
      </div>

      <h2 style={{ margin: 0, fontWeight: 800, fontSize: 32, letterSpacing: "-.03em", lineHeight: 1.1 }}>Лента пока пуста</h2>
      <p style={{ margin: "14px 0 0", maxWidth: 380, fontSize: 16, lineHeight: 1.6, color: "var(--ink4)" }}>
        Добавь друзей — и увидишь, что они смотрят, как оценивают и что советуют прямо сейчас.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 34, width: "100%", maxWidth: 380 }}>
        <Link href="/search" style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "15px 20px", borderRadius: 14, border: "none",
          background: ACCENT, color: "#17120a",
          fontFamily: "inherit", fontWeight: 700, fontSize: 15,
          textDecoration: "none",
          boxShadow: `0 12px 28px -14px ${ACCENT}`,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          Найти фильм
        </Link>
      </div>
    </div>
  );
}
