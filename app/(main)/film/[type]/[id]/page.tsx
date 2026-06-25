import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchMediaDetail, fetchOMDbRating, formatRuntime, IMG_BASE } from "@/lib/tmdb";
import { FilmActions } from "@/components/FilmActions";
import { RecommendModal } from "@/components/RecommendModal";
import { ShareButton } from "@/components/ShareButton";
import { CommentsSection } from "@/components/CommentsSection";

const ACCENT = "#F5A623";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type, id } = await params;
  if (type !== "movie" && type !== "tv") return {};
  const tmdbId = parseInt(id, 10);
  if (isNaN(tmdbId)) return {};

  const detail = await fetchMediaDetail(type as "movie" | "tv", tmdbId);
  if (!detail) return {};

  const posterUrl = detail.poster_path ? `${IMG_BASE}/w500${detail.poster_path}` : undefined;
  const year = detail.release_date?.slice(0, 4) ?? "";
  const description = detail.overview
    ? detail.overview.slice(0, 160)
    : `${detail.title}${year ? ` (${year})` : ""}`;

  return {
    title: `${detail.title} — WTCHD`,
    description,
    openGraph: {
      title: detail.title,
      description,
      images: posterUrl ? [{ url: posterUrl, width: 500, height: 750, alt: detail.title }] : [],
      type: "video.movie",
    },
    twitter: {
      card: "summary_large_image",
      title: detail.title,
      description,
      images: posterUrl ? [posterUrl] : [],
    },
  };
}

const AVATAR_COLORS = [
  "linear-gradient(150deg,#3f7e6e,#225447)",
  "linear-gradient(150deg,#7a3b4a,#3a1525)",
  "linear-gradient(150deg,#3f6fa3,#172a47)",
  "linear-gradient(150deg,#c2a23a,#5c4a1a)",
  "linear-gradient(150deg,#d35c84,#7a2347)",
];

interface PageProps {
  params: Promise<{ type: string; id: string }>;
}

export default async function FilmPage({ params }: PageProps) {
  const { type, id } = await params;

  if (type !== "movie" && type !== "tv") notFound();
  const tmdbId = parseInt(id, 10);
  if (isNaN(tmdbId)) notFound();

  // Fetch detail from TMDB (Next.js fetch cache handles dedup)
  const detail = await fetchMediaDetail(type, tmdbId);
  if (!detail) notFound();

  // Fetch IMDb rating (parallel)
  const omdbPromise = detail.imdb_id ? fetchOMDbRating(detail.imdb_id) : Promise.resolve(null);

  // Get user's status for this film
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [omdb, watchedRow, friendsRows, wchdRatingsResult] = await Promise.all([
    omdbPromise,
    user
      ? supabase
          .from("watched")
          .select("status, rating")
          .eq("user_id", user.id)
          .eq("tmdb_id", tmdbId)
          .eq("media_type", type)
          .single()
          .then((r) => r.data)
      : Promise.resolve(null),
    user
      ? supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id)
          .then(async ({ data }) => {
            if (!data || data.length === 0) return [];
            const ids = data.map((r) => r.following_id);
            const { data: profiles } = await supabase
              .from("users")
              .select("id, username, full_name, avatar_url")
              .in("id", ids);
            return profiles ?? [];
          })
      : Promise.resolve([]),
    supabase
      .from("watched")
      .select("rating")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", type)
      .not("rating", "is", null),
  ]);

  const wchdRatings = wchdRatingsResult.data ?? [];
  const wchdAvg = wchdRatings.length > 0
    ? (wchdRatings.reduce((s, r) => s + (r.rating as number), 0) / wchdRatings.length)
    : null;

  // Upsert to media_cache — always await so profile page has data
  await supabase.from("media_cache").upsert(
    {
      tmdb_id: tmdbId,
      media_type: type,
      title: detail.title,
      original_title: detail.original_title,
      poster_path: detail.poster_path,
      overview: detail.overview,
      release_date: detail.release_date,
      genres: detail.genres,
      imdb_rating: omdb?.rating ?? null,
      imdb_votes: omdb?.votes ?? null,
      runtime: detail.runtime,
      countries: detail.countries,
      cast_main: detail.cast_main,
      cached_at: new Date().toISOString(),
    },
    { onConflict: "tmdb_id" }
  );

  const year = detail.release_date?.slice(0, 4) ?? "";
  const backdropUrl = detail.backdrop_path
    ? `${IMG_BASE}/w1280${detail.backdrop_path}`
    : null;
  const posterUrl = detail.poster_path
    ? `${IMG_BASE}/w500${detail.poster_path}`
    : null;

  const userStatus = (watchedRow?.status as "want" | "watching" | "watched" | null) ?? null;
  const userRating = (watchedRow?.rating as number | null) ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── HERO ── */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {/* Backdrop */}
        {backdropUrl ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <img
              src={backdropUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35) saturate(1.2)" }}
            />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg,#1a1410,#3a241c,#7d4427)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(110deg, rgba(255,255,255,.025) 0 2px, transparent 2px 12px)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", background: "linear-gradient(to top, var(--bg) 8%, transparent)" }} />

        <div className="cc-film-hero" style={{ position: "relative", maxWidth: 960, margin: "0 auto", padding: "46px 48px 0", display: "flex", gap: 40, alignItems: "flex-end" }}>
          {/* Poster */}
          <div className="cc-film-poster" style={{
            width: 220,
            flexShrink: 0,
            aspectRatio: "2/3",
            borderRadius: 14,
            overflow: "hidden",
            background: posterUrl ? "var(--surface2)" : "linear-gradient(158deg,#d9a05b,#5e2f1c)",
            boxShadow: "0 30px 60px -22px rgba(0,0,0,.7)",
            border: "1px solid rgba(255,255,255,.12)",
            position: "relative",
            marginBottom: -32,
          }}>
            {posterUrl ? (
              <img src={posterUrl} alt={detail.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(116deg, rgba(255,255,255,.06) 0 1.5px, transparent 1.5px 9px)" }} />
            )}
          </div>

          {/* Title block */}
          <div className="cc-film-title" style={{ flex: 1, minWidth: 0, paddingBottom: 48, color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ padding: "5px 11px", borderRadius: 8, background: "rgba(255,255,255,.16)", backdropFilter: "blur(6px)", fontSize: 12, fontWeight: 700, letterSpacing: ".02em" }}>
                {type === "movie" ? "Фильм" : "Сериал"}
              </span>
              {detail.countries[0] && (
                <span style={{ padding: "5px 11px", borderRadius: 8, background: "rgba(255,255,255,.16)", backdropFilter: "blur(6px)", fontSize: 12, fontWeight: 700 }}>
                  {detail.countries[0]}
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: 46, letterSpacing: "-.035em", lineHeight: 1, textShadow: "0 2px 20px rgba(0,0,0,.35)" }}>
              {detail.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 15, color: "rgba(255,255,255,.82)", flexWrap: "wrap" }}>
              {year && <span>{year}</span>}
              {detail.genres.length > 0 && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{detail.genres.slice(0, 3).join(", ")}</span>
                </>
              )}
              {detail.runtime && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{formatRuntime(detail.runtime)}</span>
                </>
              )}
              {detail.director && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{detail.director}</span>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="cc-film-actions" style={{ marginTop: 22, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <FilmActions
                tmdbId={tmdbId}
                mediaType={type}
                initialStatus={userStatus}
                initialRating={userRating}
              />
              {user && (
                <RecommendModal
                  tmdbId={tmdbId}
                  mediaType={type}
                  title={detail.title}
                  posterUrl={posterUrl}
                  friends={friendsRows}
                />
              )}
              <ShareButton
                title={detail.title}
                url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/film/${type}/${tmdbId}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="cc-film-body" style={{ maxWidth: 960, margin: "0 auto", padding: "48px 48px 80px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 44 }}>

        {/* Left column */}
        <div style={{ minWidth: 0 }}>

          {/* Ratings */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <RatingCard
              label="IMDb"
              labelColor="#c08a1e"
              value={omdb ? omdb.rating.toFixed(1) : "—"}
              sub={omdb ? `${(omdb.votes / 1000).toFixed(0)}K оценок` : "нет данных"}
            />
            <RatingCard
              label="WTCHD"
              labelColor={ACCENT}
              value={wchdAvg !== null ? wchdAvg.toFixed(1) : "—"}
              sub={wchdRatings.length > 0 ? `${wchdRatings.length} ${pluralRatings(wchdRatings.length)}` : "пока нет оценок"}
              accent
            />
            <div style={{ background: "#0b0f1a", borderRadius: 16, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#bdb6aa" }}>Твоя оценка</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 34, lineHeight: 0.9, letterSpacing: "-.02em", color: userRating ? ACCENT : "#fff" }}>
                  {userRating ?? "—"}
                </span>
                <span style={{ fontSize: 14, color: "#8e887e", fontWeight: 700 }}>/10</span>
              </div>
              <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} style={{ flex: 1, height: 7, borderRadius: 2, background: i < (userRating ?? 0) ? ACCENT : "rgba(255,255,255,.1)" }} />
                ))}
              </div>
            </div>
          </section>

          {/* Overview */}
          {detail.overview && (
            <section style={{ marginTop: 34 }}>
              <h2 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 19, letterSpacing: "-.01em" }}>Описание</h2>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "var(--ink2)" }}>
                {detail.overview}
              </p>
            </section>
          )}

          {/* Cast */}
          {detail.cast_main.length > 0 && (
            <section style={{ marginTop: 34 }}>
              <h2 style={{ margin: "0 0 18px", fontWeight: 700, fontSize: 19, letterSpacing: "-.01em" }}>В ролях</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
                {detail.cast_main.map((actor, i) => (
                  <div key={actor.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 9 }}>
                    <div style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                      flexShrink: 0,
                    }}>
                      {actor.profile_path ? (
                        <img
                          src={`${IMG_BASE}/w185${actor.profile_path}`}
                          alt={actor.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 24 }}>
                          {actor.name[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.2 }}>{actor.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.2 }}>{actor.character}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Comments */}
          <CommentsSection
            tmdbId={tmdbId}
            mediaType={type}
            currentUserId={user?.id ?? null}
          />
        </div>

        {/* Right column */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Genres */}
          {detail.genres.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid rgba(var(--line),0.07)", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(var(--line),0.04)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Жанры</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {detail.genres.map((g) => (
                  <span key={g} style={{ padding: "5px 12px", borderRadius: 8, background: "var(--surface2)", fontSize: 13, fontWeight: 600, color: "var(--ink3)" }}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div style={{ background: "var(--surface)", border: "1px solid rgba(var(--line),0.07)", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(var(--line),0.04)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Детали</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {year && <InfoRow label="Год" value={year} />}
              {detail.runtime && <InfoRow label={type === "tv" ? "Эпизод" : "Длительность"} value={formatRuntime(detail.runtime)} />}
              {detail.director && <InfoRow label={type === "tv" ? "Создатель" : "Режиссёр"} value={detail.director} />}
              {detail.countries.length > 0 && <InfoRow label="Страна" value={detail.countries.slice(0, 3).join(", ")} />}
              {detail.original_title && detail.original_title !== detail.title && (
                <InfoRow label="Оригинал" value={detail.original_title} />
              )}
            </div>
          </div>

          {/* Streaming placeholder */}
          <div style={{ background: "var(--surface)", border: "1px solid rgba(var(--line),0.07)", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(var(--line),0.04)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Где смотреть</div>
            <div style={{ fontSize: 13.5, color: "var(--faint)" }}>Платформы скоро появятся</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pluralRatings(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return "оценок";
  if (mod10 === 1) return "оценка";
  if (mod10 >= 2 && mod10 <= 4) return "оценки";
  return "оценок";
}

function RatingCard({
  label,
  labelColor,
  value,
  sub,
  accent,
}: {
  label: string;
  labelColor: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${accent ? `color-mix(in srgb, ${ACCENT} 28%, var(--surface))` : "rgba(var(--line),0.07)"}`,
      borderRadius: 16,
      padding: "18px 20px",
      boxShadow: "0 1px 2px rgba(var(--line),0.04)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: labelColor }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 34, lineHeight: 0.9, letterSpacing: "-.02em", color: accent ? ACCENT : "var(--ink)" }}>{value}</span>
        <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 700 }}>/10</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
