"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ACCENT = "#F5A623";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

// ── Genres ────────────────────────────────────────────────────────────────────

const GENRE_LIST = [
  { id: "drama", name: "Драма", emoji: "🎭" },
  { id: "thriller", name: "Триллер", emoji: "🔪" },
  { id: "scifi", name: "Фантастика", emoji: "🚀" },
  { id: "comedy", name: "Комедия", emoji: "😂" },
  { id: "horror", name: "Ужасы", emoji: "👻" },
  { id: "doc", name: "Документальное", emoji: "🎥" },
  { id: "anime", name: "Аниме", emoji: "🌸" },
  { id: "crime", name: "Криминал", emoji: "🕵️" },
  { id: "romance", name: "Мелодрама", emoji: "💔" },
  { id: "action", name: "Боевик", emoji: "💥" },
  { id: "fantasy", name: "Фэнтези", emoji: "🐉" },
  { id: "arthouse", name: "Артхаус", emoji: "🎬" },
];

// ── Default catalog (empty — populated from API on step 2) ────────────────────

const DEFAULT_CATALOG: Movie[] = [];

// ── Welcome posters ───────────────────────────────────────────────────────────

const WELCOME_POSTERS = [
  { bg: "linear-gradient(158deg,#d9a05b,#5e2f1c)", t: "rotate(-9deg)", ml: "0" },
  { bg: "linear-gradient(158deg,#7a3b4a,#171029)", t: "rotate(-4deg) translateY(-6px)", ml: "-18px" },
  { bg: "linear-gradient(150deg,#4bb3a6,#3a2a5c)", t: "rotate(0deg) translateY(-12px)", ml: "-18px" },
  { bg: "linear-gradient(158deg,#3f6fa3,#172a47)", t: "rotate(4deg) translateY(-6px)", ml: "-18px" },
  { bg: "linear-gradient(158deg,#d35c84,#7a2347)", t: "rotate(9deg)", ml: "-18px" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4;

interface Movie {
  id: number;
  title: string;
  year: string;
  type: string;
  poster: string | null;
  bg?: string;
}

// ── Gradient fallbacks (by id mod) ───────────────────────────────────────────

const FALLBACK_GRADIENTS = [
  "linear-gradient(158deg,#d9a05b,#5e2f1c)",
  "linear-gradient(158deg,#7a3b4a,#171029)",
  "linear-gradient(150deg,#4bb3a6,#3a2a5c)",
  "linear-gradient(158deg,#3f6fa3,#172a47)",
  "linear-gradient(158deg,#d35c84,#7a2347)",
  "linear-gradient(158deg,#c2a23a,#5c5a1f)",
  "linear-gradient(158deg,#5b7a99,#162636)",
  "linear-gradient(158deg,#8aa6c4,#2e3550)",
  "linear-gradient(158deg,#e08a2c,#1a1410)",
  "linear-gradient(158deg,#6b6f8c,#26283f)",
];

function fallbackBg(id: number) {
  return FALLBACK_GRADIENTS[id % FALLBACK_GRADIENTS.length];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [pickedMovies, setPickedMovies] = useState<Map<number, Movie>>(new Map());
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<Movie[]>(DEFAULT_CATALOG);
  const [popularCatalog, setPopularCatalog] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [popularLoaded, setPopularLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickCount = pickedMovies.size;
  const genreCount = selectedGenres.size;

  // ── Load popular when entering step 2 ───────────────────────────────────────

  useEffect(() => {
    if (step !== 2 || popularLoaded) return;
    setSearching(true);
    fetch("/api/tmdb/popular")
      .then((r) => r.json())
      .then((data) => {
        const results = data.results ?? [];
        setCatalog(results);
        setPopularCatalog(results);
        setPopularLoaded(true);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [step, popularLoaded]);

  // ── TMDB search ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setCatalog(popularCatalog);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setCatalog(data.results);
      } catch {
        // keep current catalog on error
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, step, popularCatalog]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleGenre = useCallback((id: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleMovie = useCallback((movie: Movie) => {
    setPickedMovies((prev) => {
      const next = new Map(prev);
      if (next.has(movie.id)) {
        next.delete(movie.id);
      } else if (next.size < 5) {
        next.set(movie.id, movie);
      }
      return next;
    });
  }, []);

  const canNext =
    step === 0 ||
    (step === 1 && genreCount >= 3) ||
    (step === 2 && pickCount >= 5) ||
    step === 3;

  const handleFinish = useCallback(async () => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const picked = Array.from(pickedMovies.values());

    await Promise.all([
      supabase
        .from("users")
        .update({ favorite_genres: Array.from(selectedGenres) })
        .eq("id", user.id),

      supabase.from("media_cache").upsert(
        picked.map((m) => ({
          tmdb_id: m.id,
          media_type: m.type,
          title: m.title,
          poster_path: m.poster ? m.poster.replace(IMAGE_BASE, "") : null,
          release_date: m.year ? `${m.year}-01-01` : null,
          cached_at: new Date().toISOString(),
        })),
        { onConflict: "tmdb_id,media_type" }
      ),

      supabase.from("watched").upsert(
        picked.map((m) => ({
          user_id: user.id,
          tmdb_id: m.id,
          media_type: m.type,
          status: "watched",
          rating: ratings[m.id] ?? null,
          review: comments[m.id] ?? null,
          watched_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,tmdb_id,media_type" }
      ),
    ]);

    setStep(4);
    window.scrollTo(0, 0);
    setSaving(false);
  }, [selectedGenres, pickedMovies, ratings, comments, router]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    if (step === 3) { handleFinish(); return; }
    setStep((s) => (s + 1) as Step);
    window.scrollTo(0, 0);
  }, [canNext, step, handleFinish]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1) as Step);
    window.scrollTo(0, 0);
  }, []);

  const pickedItems = Array.from(pickedMovies.values());

  const stepHint =
    step === 1
      ? genreCount >= 3 ? `Выбрано ${genreCount}` : `Ещё ${3 - genreCount} жанра минимум`
      : step === 2
      ? pickCount >= 5 ? "Отлично! Все 5 выбраны" : `Выбрано ${pickCount} из 5`
      : step === 3
      ? "Оценки можно изменить позже"
      : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--ink)" }}>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 36px",
        background: "rgba(var(--bgRGB),0.86)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(var(--line),0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <WchdLogo />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.03em" }}>WTCHD</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {step >= 1 && step <= 3 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {[1, 2, 3].map((n) => (
                <span key={n} style={{
                  height: 7, borderRadius: 4, transition: "all .35s ease",
                  width: step === n ? 26 : 7,
                  background: step > n ? ACCENT : step === n ? ACCENT : "rgba(var(--line),0.18)",
                }} />
              ))}
            </div>
          )}
          {step >= 1 && step <= 3 && (
            <button
              onClick={() => handleFinish()}
              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--muted)", fontFamily: "inherit" }}
            >
              Пропустить
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* STEP 0: Welcome */}
        {step === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 32px" }}>
            <div style={{ display: "flex", marginBottom: 34 }}>
              {WELCOME_POSTERS.map((p, i) => (
                <div key={i} style={{ width: 84, height: 124, borderRadius: 11, flexShrink: 0, background: p.bg, boxShadow: "0 16px 34px -16px rgba(0,0,0,.5)", transform: p.t, marginLeft: p.ml }} />
              ))}
            </div>
            <h1 style={{ margin: 0, maxWidth: 600, fontWeight: 800, fontSize: 48, lineHeight: 1.02, letterSpacing: "-.035em" }}>
              Добро пожаловать в свой кинокруг
            </h1>
            <p style={{ margin: "18px 0 0", maxWidth: 460, fontSize: 17, lineHeight: 1.55, color: "var(--ink4)" }}>
              Отмечай, что смотришь, ставь оценки и следи за тем, что любят друзья. Давай за минуту настроим твою ленту.
            </p>
            <button onClick={() => setStep(1)} style={{
              marginTop: 36, padding: "16px 40px", border: "none", borderRadius: 13,
              background: ACCENT, color: "#17120a", fontFamily: "inherit", fontWeight: 700, fontSize: 16,
              cursor: "pointer", boxShadow: `0 14px 30px -14px ${ACCENT}`,
            }}>
              Начать настройку
            </button>
            <div style={{ marginTop: 18, fontSize: 13.5, color: "var(--muted)" }}>Займёт меньше минуты · 3 шага</div>
          </div>
        )}

        {/* STEP 1: Genres */}
        {step === 1 && (
          <div style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "46px 32px 130px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ACCENT }}>Шаг 1 из 3</div>
            <h1 style={{ margin: "10px 0 0", fontWeight: 800, fontSize: 38, letterSpacing: "-.03em", lineHeight: 1.05 }}>Что ты любишь смотреть?</h1>
            <p style={{ margin: "10px 0 0", fontSize: 16, color: "var(--ink4)" }}>Выбери минимум 3 жанра — так мы подберём рекомендации под тебя.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
              {GENRE_LIST.map((g) => {
                const on = selectedGenres.has(g.id);
                return (
                  <button key={g.id} onClick={() => toggleGenre(g.id)} style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    padding: "12px 20px", borderRadius: 13, fontFamily: "inherit",
                    fontWeight: 600, fontSize: 15, cursor: "pointer", transition: "all .15s",
                    background: on ? ACCENT : "var(--surface)",
                    color: on ? "#0b0f1a" : "var(--ink2)",
                    border: `1.5px solid ${on ? ACCENT : "rgba(var(--line),0.12)"}`,
                  }}>
                    <span style={{ fontSize: 19 }}>{g.emoji}</span>
                    {g.name}
                    {on && <span style={{ fontSize: 13 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Pick movies */}
        {step === 2 && (
          <div style={{ flex: 1, maxWidth: 940, width: "100%", margin: "0 auto", padding: "46px 32px 130px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ACCENT }}>Шаг 2 из 3</div>
            <h1 style={{ margin: "10px 0 0", fontWeight: 800, fontSize: 38, letterSpacing: "-.03em", lineHeight: 1.05 }}>Добавь 5 фильмов, что уже смотрел</h1>
            <p style={{ margin: "10px 0 0", fontSize: 16, color: "var(--ink4)" }}>Найди и отметь то, что запомнилось — оценки добавим на следующем шаге.</p>

            {/* search bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 11, marginTop: 26,
              background: "var(--surface)", border: "1.5px solid rgba(var(--line),0.12)",
              borderRadius: 14, padding: "14px 18px",
              boxShadow: "0 1px 2px rgba(var(--line),0.04)",
            }}>
              {searching
                ? <Spinner />
                : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                  </svg>
                )}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск фильмов и сериалов…"
                style={{ border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 15, width: "100%", color: "var(--ink)" }}
              />
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>{pickCount} / 5</span>
            </div>

            {/* grid */}
            {catalog.length === 0 && !searching && query.trim() && (
              <div style={{ marginTop: 48, textAlign: "center", color: "var(--muted)", fontSize: 15 }}>
                Ничего не найдено — попробуй другой запрос
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginTop: 24 }}>
              {searching && catalog.length === 0 && Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{
                    aspectRatio: "2/3", borderRadius: 11,
                    background: "var(--surface)",
                    animation: "pulse 1.4s ease-in-out infinite",
                  }} />
                  <div style={{ height: 12, width: "60%", borderRadius: 6, background: "var(--surface)", animation: "pulse 1.4s ease-in-out infinite" }} />
                </div>
              ))}
              {catalog.map((m) => {
                const on = pickedMovies.has(m.id);
                return (
                  <button key={m.id} onClick={() => toggleMovie(m)} style={{
                    display: "block", padding: 0, border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                  }}>
                    <div style={{
                      position: "relative", aspectRatio: "2/3", borderRadius: 11,
                      overflow: "hidden",
                      background: m.poster ? "var(--surface2)" : (m.bg ?? fallbackBg(m.id)),
                      boxShadow: "0 8px 20px -12px rgba(0,0,0,.5)",
                      outline: `3px solid ${on ? ACCENT : "transparent"}`,
                      outlineOffset: 2, transition: "transform .15s",
                    }}>
                      {m.poster
                        ? <img src={m.poster} alt={m.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        : (
                          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(116deg, rgba(255,255,255,.05) 0 1.5px, transparent 1.5px 8px)" }} />
                        )
                      }
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.72), transparent 55%)" }} />
                      <div style={{ position: "absolute", left: 9, right: 9, bottom: 9, color: "#fff", fontWeight: 700, fontSize: 12, lineHeight: 1.15 }}>{m.title}</div>
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        width: 24, height: 24, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: on ? ACCENT : "rgba(0,0,0,.35)", transition: "all .15s",
                      }}>
                        {on && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      {m.year}
                      {m.type === "tv" && <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(var(--line),0.08)", padding: "1px 5px", borderRadius: 4 }}>Сериал</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Rate */}
        {step === 3 && (
          <div style={{ flex: 1, maxWidth: 720, width: "100%", margin: "0 auto", padding: "46px 32px 130px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: ACCENT }}>Шаг 3 из 3</div>
            <h1 style={{ margin: "10px 0 0", fontWeight: 800, fontSize: 38, letterSpacing: "-.03em", lineHeight: 1.05 }}>Оцени, что посмотрел</h1>
            <p style={{ margin: "10px 0 0", fontSize: 16, color: "var(--ink4)" }}>Поставь оценку и, если хочешь, оставь пару слов — друзья увидят их в ленте.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 30 }}>
              {pickedItems.map((m) => {
                const score = ratings[m.id] ?? 0;
                return (
                  <div key={m.id} style={{
                    display: "flex", gap: 18,
                    background: "var(--surface)", border: "1px solid rgba(var(--line),0.08)",
                    borderRadius: 18, padding: 18,
                    boxShadow: "0 1px 2px rgba(var(--line),0.04)",
                  }}>
                    <div style={{
                      width: 74, height: 111, flexShrink: 0, borderRadius: 9,
                      background: m.poster ? "var(--surface2)" : (m.bg ?? fallbackBg(m.id)),
                      boxShadow: "0 8px 18px -10px rgba(0,0,0,.5)",
                      position: "relative", overflow: "hidden",
                    }}>
                      {m.poster
                        ? <img src={m.poster} alt={m.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(116deg, rgba(255,255,255,.05) 0 1.5px, transparent 1.5px 8px)" }} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.01em" }}>{m.title}</div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                        {m.year}{m.type === "tv" ? " · Сериал" : ""}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {Array.from({ length: 10 }, (_, i) => (
                            <span key={i} onClick={() => setRatings((r) => ({ ...r, [m.id]: i + 1 }))} style={{
                              width: 18, height: 18, borderRadius: "50%", cursor: "pointer",
                              transition: "all .1s",
                              background: i < score ? ACCENT : "rgba(var(--line),0.1)",
                            }} />
                          ))}
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 18, color: score ? ACCENT : "var(--faint)", minWidth: 46 }}>
                          {score ? `${score}/10` : "—"}
                        </span>
                      </div>
                      <input
                        value={comments[m.id] ?? ""}
                        onChange={(e) => setComments((c) => ({ ...c, [m.id]: e.target.value }))}
                        placeholder="Добавить комментарий…"
                        style={{
                          marginTop: 12, width: "100%",
                          border: "none", borderBottom: "1.5px solid rgba(var(--line),0.12)",
                          outline: "none", background: "transparent",
                          fontFamily: "inherit", fontSize: 14.5, padding: "6px 0", color: "var(--ink)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 4 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 32px" }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%", background: ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 20px 40px -16px ${ACCENT}`,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 style={{ margin: "30px 0 0", maxWidth: 520, fontWeight: 800, fontSize: 46, lineHeight: 1.02, letterSpacing: "-.035em" }}>Всё готово!</h1>
            <p style={{ margin: "18px 0 0", maxWidth: 440, fontSize: 17, lineHeight: 1.55, color: "var(--ink4)" }}>
              Лента собрана под твой вкус. Зови друзей — вместе кино смотреть интереснее.
            </p>
            <button onClick={() => router.push("/feed")} style={{
              marginTop: 36, display: "inline-flex", alignItems: "center", gap: 9,
              padding: "16px 42px", borderRadius: 13, border: "none",
              background: ACCENT, color: "#17120a", fontFamily: "inherit",
              fontWeight: 700, fontSize: 16, cursor: "pointer",
              boxShadow: `0 14px 30px -14px ${ACCENT}`,
            }}>
              Перейти в ленту
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Footer nav ── */}
      {step >= 1 && step <= 3 && (
        <footer style={{
          position: "sticky", bottom: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          padding: "18px 36px",
          background: "rgba(var(--bgRGB),0.9)", backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(var(--line),0.08)",
        }}>
          <button onClick={goBack} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 22px", borderRadius: 12,
            border: "1.5px solid rgba(var(--line),0.14)", background: "var(--surface)",
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 14.5, color: "var(--ink3)",
            visibility: step <= 1 ? "hidden" : "visible",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Назад
          </button>

          <div style={{ fontSize: 13.5, color: "var(--muted)", fontWeight: 500 }}>{stepHint}</div>

          <button onClick={goNext} disabled={!canNext || saving} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 28px", borderRadius: 12, border: "none",
            cursor: canNext && !saving ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontWeight: 700, fontSize: 14.5,
            background: canNext ? ACCENT : "rgba(var(--line),0.1)",
            color: canNext ? "#0b0f1a" : "var(--faint)",
            opacity: canNext && !saving ? 1 : 0.7, transition: "all .15s",
          }}>
            {saving ? "Сохраняем…" : step === 3 ? "Завершить" : "Далее"}
            {!saving && (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </footer>
      )}
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function WchdLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      <line x1="33" y1="33" x2="67" y2="67" stroke={ACCENT} strokeWidth="12" strokeLinecap="round" />
      <rect x="15" y="15" width="35" height="35" rx="9" fill={ACCENT} />
      <rect x="50" y="50" width="35" height="35" rx="9" fill={ACCENT} />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
