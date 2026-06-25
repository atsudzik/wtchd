import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchMediaDetail } from "@/lib/tmdb";
import { ProfileContent, type WatchedItem } from "@/components/ProfileContent";
import { FollowButton } from "@/components/FollowButton";

const ACCENT = "#F5A623";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Current viewer
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // Fetch profile by username
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, full_name, bio, avatar_url, favorite_genres, created_at")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const isOwnProfile = viewer?.id === profile.id;

  // Parallel: watched items, follow counts, viewer's follow status
  const [watchedResult, followersResult, followingResult, isFollowingResult] =
    await Promise.all([
      supabase
        .from("watched")
        .select("tmdb_id, media_type, status, rating, watched_at")
        .eq("user_id", profile.id)
        .order("watched_at", { ascending: false }),

      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", profile.id),

      supabase
        .from("follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", profile.id),

      viewer && !isOwnProfile
        ? supabase
            .from("follows")
            .select("follower_id", { count: "exact", head: true })
            .eq("follower_id", viewer.id)
            .eq("following_id", profile.id)
        : Promise.resolve({ count: 0 }),
    ]);

  const watchedRows = watchedResult.data ?? [];
  const followersCount = followersResult.count ?? 0;
  const followingCount = followingResult.count ?? 0;
  const isFollowing = (isFollowingResult.count ?? 0) > 0;

  // Fetch media_cache for all tmdb_ids
  const tmdbIds = [...new Set(watchedRows.map((w) => w.tmdb_id))];
  const mediaMap = new Map<number, { title: string; poster_path: string | null; release_date: string | null }>();

  if (tmdbIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from("media_cache")
      .select("tmdb_id, title, poster_path, release_date")
      .in("tmdb_id", tmdbIds);

    for (const m of mediaRows ?? []) {
      mediaMap.set(m.tmdb_id, {
        title: m.title,
        poster_path: m.poster_path,
        release_date: m.release_date,
      });
    }

    // For any tmdb_id still missing from cache, fetch from TMDB and backfill
    const missing = watchedRows.filter((w) => !mediaMap.has(w.tmdb_id));
    if (missing.length > 0) {
      const fetched = await Promise.allSettled(
        missing.map((w) => fetchMediaDetail(w.media_type as "movie" | "tv", w.tmdb_id))
      );
      const toUpsert: object[] = [];
      fetched.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          const d = result.value;
          mediaMap.set(d.tmdb_id, {
            title: d.title,
            poster_path: d.poster_path,
            release_date: d.release_date,
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
  }

  // Merge
  const items: WatchedItem[] = watchedRows.map((w) => {
    const media = mediaMap.get(w.tmdb_id);
    return {
      tmdb_id: w.tmdb_id,
      media_type: w.media_type,
      status: w.status as WatchedItem["status"],
      rating: w.rating,
      watched_at: w.watched_at,
      title: media?.title ?? `#${w.tmdb_id}`,
      poster_path: media?.poster_path ?? null,
      release_date: media?.release_date ?? null,
    };
  });

  // Stats
  const watchedCount = items.filter((i) => i.status === "watched").length;
  const avgRating =
    items.filter((i) => i.rating != null).length > 0
      ? (
          items.reduce((s, i) => s + (i.rating ?? 0), 0) /
          items.filter((i) => i.rating != null).length
        ).toFixed(1)
      : "—";

  const initial = (profile.full_name ?? profile.username ?? "?")[0].toUpperCase();

  return (
    <div className="cc-page" style={{ padding: "0 40px 64px", maxWidth: 940, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="cc-profile-header" style={{ display: "flex", alignItems: "flex-end", gap: 26, marginTop: 44, padding: "0 4px" }}>
        {/* Avatar */}
        <div className="cc-profile-avatar" style={{
          width: 128,
          height: 128,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          background: "linear-gradient(150deg,#3f7e6e,#225447)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: 48,
          boxShadow: "0 12px 30px -16px rgba(0,0,0,.5)",
        }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name ?? username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initial
          )}
        </div>

        {/* Name + actions */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontWeight: 800, fontSize: 30, letterSpacing: "-.03em", lineHeight: 1 }}>
                {profile.full_name ?? profile.username}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
                <span style={{ fontSize: 14.5, color: "var(--ink4)" }}>@{profile.username}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isOwnProfile ? (
                <Link
                  href="/settings"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "11px 22px",
                    borderRadius: 11,
                    fontFamily: "inherit",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                    background: "var(--surface)",
                    color: "var(--ink3)",
                    border: "1px solid rgba(var(--line),0.16)",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Редактировать профиль
                </Link>
              ) : viewer ? (
                <FollowButton targetUserId={profile.id} initialFollowing={isFollowing} />
              ) : (
                <Link
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "11px 22px",
                    borderRadius: 11,
                    fontFamily: "inherit",
                    fontWeight: 600,
                    fontSize: 14,
                    textDecoration: "none",
                    background: ACCENT,
                    color: "#0b0f1a",
                    border: `1px solid ${ACCENT}`,
                  }}
                >
                  Подписаться
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bio + genres ── */}
      <div style={{ marginTop: 18, padding: "0 4px", maxWidth: 620 }}>
        {profile.bio && (
          <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.55, color: "var(--ink2)" }}>
            {profile.bio}
          </p>
        )}
        {(profile.favorite_genres ?? []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(profile.favorite_genres as string[]).map((g) => (
              <span key={g} style={{
                padding: "6px 13px",
                borderRadius: 9,
                background: "var(--surface)",
                border: "1px solid rgba(var(--line),0.1)",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--ink3)",
              }}>
                {GENRE_LABELS[g] ?? g}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {[
          { value: watchedCount, label: "посмотрено" },
          { value: followersCount, label: "подписчиков" },
          { value: followingCount, label: "подписок" },
          { value: avgRating, label: "средняя оценка" },
        ].map(({ value, label }) => (
          <div key={label} style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid rgba(var(--line),0.07)",
            borderRadius: 15,
            padding: "16px 18px",
            boxShadow: "0 1px 2px rgba(var(--line),0.04)",
          }}>
            <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: "-.02em", lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink4)", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs + grid (client) ── */}
      <ProfileContent items={items} isOwnProfile={isOwnProfile} />
    </div>
  );
}

const GENRE_LABELS: Record<string, string> = {
  drama: "Драма",
  thriller: "Триллер",
  scifi: "Фантастика",
  comedy: "Комедия",
  horror: "Ужасы",
  doc: "Документальное",
  anime: "Аниме",
  crime: "Криминал",
  romance: "Мелодрама",
  action: "Боевик",
  fantasy: "Фэнтези",
  arthouse: "Артхаус",
};
