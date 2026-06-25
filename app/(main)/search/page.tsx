"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ACCENT = "#F5A623";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";

// ── Film types ────────────────────────────────────────────────────────────────

interface FilmResult {
  id: number;
  title: string;
  year: string;
  type: string;
  poster: string | null;
  rating: number;
}

// ── User types ────────────────────────────────────────────────────────────────

interface UserResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  watched_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FALLBACK_GRADIENTS = [
  "linear-gradient(158deg,#d9a05b,#5e2f1c)",
  "linear-gradient(158deg,#7a3b4a,#171029)",
  "linear-gradient(150deg,#4bb3a6,#3a2a5c)",
  "linear-gradient(158deg,#3f6fa3,#172a47)",
  "linear-gradient(158deg,#d35c84,#7a2347)",
  "linear-gradient(158deg,#c2a23a,#5c5a1f)",
];
const AVATAR_BG = [
  "linear-gradient(150deg,#3f7e6e,#225447)",
  "linear-gradient(150deg,#c0764b,#7a3c24)",
  "linear-gradient(150deg,#6b6f8c,#26283f)",
  "linear-gradient(150deg,#5ba39a,#235447)",
  "linear-gradient(150deg,#4f6d8c,#26384d)",
  "linear-gradient(150deg,#b0566b,#3a1822)",
];
function fallbackBg(id: number) { return FALLBACK_GRADIENTS[id % FALLBACK_GRADIENTS.length]; }
function avatarBg(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "films" | "people";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("films");
  const [filmResults, setFilmResults] = useState<FilmResult[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [popular, setPopular] = useState<FilmResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load current user + their follows
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      supabase.from("follows").select("following_id").eq("follower_id", user.id)
        .then(({ data }) => setFollowingIds(new Set(data?.map((r) => r.following_id) ?? [])));
    });
  }, []);

  // Load popular films on mount
  useEffect(() => {
    fetch("/api/tmdb/popular")
      .then((r) => r.json())
      .then((d) => setPopular(d.results ?? []))
      .catch(() => {});
    inputRef.current?.focus();
  }, []);

  // Auto-switch to "people" when query starts with @
  useEffect(() => {
    if (query.startsWith("@")) setTab("people");
  }, [query]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.startsWith("@") ? query.slice(1) : query;

    if (!q.trim()) {
      setFilmResults([]);
      setUserResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        if (tab === "films") {
          const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q.trim())}`);
          const d = await res.json();
          setFilmResults(d.results ?? []);
        } else {
          await searchUsers(q.trim());
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, tab]);

  async function searchUsers(q: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url")
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq("id", currentUserId ?? "00000000-0000-0000-0000-000000000000")
      .limit(20);

    if (!data || data.length === 0) { setUserResults([]); return; }

    // Get watched counts for each user
    const ids = data.map((u) => u.id);
    const { data: watchedRows } = await supabase
      .from("watched")
      .select("user_id")
      .in("user_id", ids)
      .eq("status", "watched");

    const countMap = new Map<string, number>();
    for (const r of watchedRows ?? []) countMap.set(r.user_id, (countMap.get(r.user_id) ?? 0) + 1);

    setUserResults(data.map((u) => ({ ...u, watched_count: countMap.get(u.id) ?? 0 })));
  }

  function handleFollow(userId: string, isFollowing: boolean) {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      isFollowing ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  const filmCatalog = query.trim() && !query.startsWith("@") ? filmResults : popular;
  const showEmpty = searching === false && query.trim() && (
    tab === "films" ? filmResults.length === 0 && !query.startsWith("@")
    : userResults.length === 0
  );

  return (
    <div className="cc-page" style={{ padding: "46px 48px 72px", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 22px", fontWeight: 800, fontSize: 32, letterSpacing: "-.03em" }}>Поиск</h1>

      {/* Search bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface)",
        border: "1.5px solid rgba(var(--line),0.12)",
        borderRadius: 14, padding: "14px 18px",
        boxShadow: "0 1px 3px rgba(var(--line),0.06)",
        marginBottom: 20,
      }}>
        {searching ? <Spinner /> : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "films" ? "Фильм, сериал, аниме…" : "Имя или @username…"}
          style={{
            border: "none", outline: "none", background: "transparent",
            fontFamily: "inherit", fontSize: 16, width: "100%", color: "var(--ink)",
          }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
        {(["films", "people"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 18px", borderRadius: 10, border: "none",
              background: tab === t ? ACCENT : "rgba(var(--line),0.07)",
              color: tab === t ? "#0b0f1a" : "var(--ink3)",
              fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
              cursor: "pointer", transition: "all .13s",
            }}
          >
            {t === "films" ? "Фильмы" : "Люди"}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {showEmpty && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)", fontSize: 15 }}>
          {tab === "people" ? "Пользователи не найдены" : "Ничего не найдено — попробуй другой запрос"}
        </div>
      )}

      {/* ── Films ── */}
      {tab === "films" && (
        <>
          {!query.trim() && (
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 18 }}>
              Популярное сейчас
            </div>
          )}

          {/* Skeleton */}
          {!query.trim() && filmCatalog.length === 0 && (
            <div className="cc-film-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ aspectRatio: "2/3", borderRadius: 11, background: "var(--surface)", animation: "pulse 1.4s ease-in-out infinite" }} />
                  <div style={{ height: 12, width: "60%", borderRadius: 6, background: "var(--surface)", animation: "pulse 1.4s ease-in-out infinite" }} />
                </div>
              ))}
            </div>
          )}

          {filmCatalog.length > 0 && (
            <div className="cc-film-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              {filmCatalog.map((m) => (
                <Link key={`${m.id}-${m.type}`} href={`/film/${m.type}/${m.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  <div style={{
                    position: "relative", aspectRatio: "2/3", borderRadius: 11,
                    overflow: "hidden",
                    background: m.poster ? "var(--surface2)" : fallbackBg(m.id),
                    boxShadow: "0 8px 20px -12px rgba(0,0,0,.5)",
                    transition: "transform .15s",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {m.poster && <img src={m.poster} alt={m.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                    {!m.poster && <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(116deg, rgba(255,255,255,.05) 0 1.5px, transparent 1.5px 8px)" }} />}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.7), transparent 55%)" }} />
                    <div style={{ position: "absolute", left: 9, right: 9, bottom: 9, color: "#fff", fontWeight: 700, fontSize: 12, lineHeight: 1.15 }}>{m.title}</div>
                    {m.rating > 0 && (
                      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)", color: "#fff", fontWeight: 700, fontSize: 11, borderRadius: 6, padding: "2px 6px" }}>
                        ★ {m.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    {m.year}
                    {m.type === "tv" && <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(var(--line),0.08)", padding: "1px 5px", borderRadius: 4 }}>Сериал</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── People ── */}
      {tab === "people" && (
        <>
          {!query.trim() && (
            <div style={{ textAlign: "center", padding: "56px 0", color: "var(--muted)", fontSize: 15 }}>
              Введи имя или @username чтобы найти друзей
            </div>
          )}

          {userResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {userResults.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  isFollowing={followingIds.has(u.id)}
                  currentUserId={currentUserId}
                  onFollowChange={(isFollowing) => handleFollow(u.id, isFollowing)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── UserCard ──────────────────────────────────────────────────────────────────

function UserCard({
  user, isFollowing, currentUserId, onFollowChange,
}: {
  user: UserResult;
  isFollowing: boolean;
  currentUserId: string | null;
  onFollowChange: (wasFollowing: boolean) => void;
}) {
  const [following, setFollowing] = useState(isFollowing);
  const [loading, setLoading] = useState(false);
  const initial = (user.full_name ?? user.username ?? "?")[0].toUpperCase();

  async function toggle() {
    if (!currentUserId || loading) return;
    setLoading(true);
    const supabase = createClient();
    const wasFollowing = following;

    if (wasFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", user.id);
    } else {
      await Promise.all([
        supabase.from("follows").insert({ follower_id: currentUserId, following_id: user.id }),
        supabase.from("notifications").insert({ user_id: user.id, actor_id: currentUserId, type: "follow", is_read: false }),
      ]);
    }

    setFollowing(!wasFollowing);
    onFollowChange(wasFollowing);
    setLoading(false);
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px", borderRadius: 16,
      background: "var(--surface)",
      border: "1px solid rgba(var(--line),0.07)",
      boxShadow: "0 1px 2px rgba(var(--line),0.04)",
    }}>
      <Link href={`/${user.username ?? ""}`} style={{ display: "block", flexShrink: 0, textDecoration: "none" }}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.full_name ?? ""} style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: 50, height: 50, borderRadius: "50%",
            background: avatarBg(user.id),
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 20,
          }}>
            {initial}
          </div>
        )}
      </Link>

      <Link href={`/${user.username ?? ""}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: "var(--ink)" }}>
          {user.full_name ?? user.username}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>@{user.username}</div>
        {user.watched_count > 0 && (
          <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 4 }}>
            {user.watched_count} {user.watched_count === 1 ? "фильм" : user.watched_count < 5 ? "фильма" : "фильмов"} посмотрено
          </div>
        )}
      </Link>

      {currentUserId && (
        <button
          onClick={toggle}
          disabled={loading}
          style={{
            flexShrink: 0,
            padding: "9px 18px", borderRadius: 10, border: "none",
            background: following ? "rgba(var(--line),0.08)" : ACCENT,
            color: following ? "var(--ink3)" : "#0b0f1a",
            fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
            cursor: loading ? "wait" : "pointer",
            transition: "all .13s",
          }}
        >
          {following ? "Отписаться" : "Подписаться"}
        </button>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
