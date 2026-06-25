"use client";

import { useState } from "react";
import Link from "next/link";

const ACCENT = "#F5A623";

type WatchStatus = "watched" | "watching" | "want";
type MediaFilter = "all" | "movie" | "tv";

export interface WatchedItem {
  tmdb_id: number;
  media_type: string;
  status: WatchStatus;
  rating: number | null;
  watched_at: string | null;
  title: string;
  poster_path: string | null;
  release_date: string | null;
}

interface ProfileContentProps {
  items: WatchedItem[];
  isOwnProfile: boolean;
}

const TAB_LABELS: Record<WatchStatus, string> = {
  watched: "Посмотрел",
  watching: "Смотрю",
  want: "Хочу посмотреть",
};

export function ProfileContent({ items, isOwnProfile }: ProfileContentProps) {
  const [tab, setTab] = useState<WatchStatus>("watched");
  const [filter, setFilter] = useState<MediaFilter>("all");

  const counts: Record<WatchStatus, number> = {
    watched: items.filter((i) => i.status === "watched").length,
    watching: items.filter((i) => i.status === "watching").length,
    want: items.filter((i) => i.status === "want").length,
  };

  const filtered = items.filter((i) => {
    if (i.status !== tab) return false;
    if (filter === "movie") return i.media_type === "movie";
    if (filter === "tv") return i.media_type === "tv";
    return true;
  });

  return (
    <div>
      {/* Tabs + filters row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        marginTop: 30,
        borderBottom: "1px solid rgba(var(--line),0.1)",
        flexWrap: "wrap",
      }}>
        {(["watched", "watching", "want"] as WatchStatus[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 18px 15px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14.5,
                fontWeight: 600,
                color: active ? "var(--ink)" : "var(--muted)",
              }}
            >
              {isOwnProfile ? TAB_LABELS[t] : TAB_LABELS[t].replace("Посмотрел", "Посмотрел")}
              <span style={{
                minWidth: 22,
                height: 20,
                padding: "0 6px",
                borderRadius: 7,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11.5,
                fontWeight: 700,
                background: active
                  ? `color-mix(in srgb, ${ACCENT} 13%, var(--surface))`
                  : "rgba(var(--line),0.06)",
                color: active ? ACCENT : "var(--muted)",
              }}>
                {counts[t]}
              </span>
              <span style={{
                position: "absolute",
                left: 14,
                right: 14,
                bottom: -1,
                height: 2.5,
                borderRadius: 3,
                background: active ? ACCENT : "transparent",
              }} />
            </button>
          );
        })}

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 5, marginLeft: "auto", marginRight: 8, padding: 3, background: "rgba(var(--line),0.05)", borderRadius: 10 }}>
          {([["all", "Все"], ["movie", "Фильмы"], ["tv", "Сериалы"]] as [MediaFilter, string][]).map(([f, label]) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 13,
                  background: on ? "var(--surface)" : "transparent",
                  color: on ? "var(--ink)" : "var(--muted)",
                  boxShadow: on ? "0 1px 3px rgba(var(--line),0.12)" : "none",
                  transition: "all .15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "64px 0",
          color: "var(--muted)",
          fontSize: 15,
        }}>
          {tab === "watched" && "Пока ничего не посмотрено"}
          {tab === "watching" && "Ничего не смотришь прямо сейчас"}
          {tab === "want" && "Список «хочу посмотреть» пуст"}
        </div>
      ) : (
        <div className="cc-film-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 18,
          marginTop: 26,
        }}>
          {filtered.map((m) => (
            <PosterCard key={`${m.tmdb_id}-${m.media_type}`} item={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function PosterCard({ item }: { item: WatchedItem }) {
  const year = item.release_date?.slice(0, 4) ?? "";
  const posterUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  const STATUS_BADGE: Record<WatchStatus, { label: string; bg: string; color: string }> = {
    watched: { label: "Посмотрел", bg: "rgba(0,0,0,.55)", color: "#fff" },
    watching: { label: "Смотрю", bg: `${ACCENT}E6`, color: "#0b0f1a" },
    want: { label: "Хочу", bg: "rgba(0,0,0,.55)", color: "#fff" },
  };
  const badge = STATUS_BADGE[item.status];

  return (
    <Link
      href={`/film/${item.media_type}/${item.tmdb_id}`}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "2/3",
          borderRadius: 11,
          overflow: "hidden",
          background: posterUrl ? "var(--surface2)" : fallbackBg(item.tmdb_id),
          boxShadow: "0 8px 22px -12px rgba(0,0,0,.5)",
          transition: "transform .18s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(116deg, rgba(255,255,255,.05) 0 1.5px, transparent 1.5px 8px)" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.1) 42%, transparent 70%)" }} />

        {/* Status badge (only for non-watched) */}
        {item.status !== "watched" && (
          <span style={{
            position: "absolute",
            top: 9,
            left: 9,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 9px",
            borderRadius: 8,
            fontSize: 10.5,
            fontWeight: 700,
            background: badge.bg,
            color: badge.color,
            backdropFilter: "blur(6px)",
          }}>
            {item.status === "watching" && (
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0b0f1a", animation: "ccLive 1.8s infinite" }} />
            )}
            {badge.label}
          </span>
        )}

        {/* Rating badge */}
        {item.rating != null && (
          <span style={{
            position: "absolute",
            top: 9,
            right: 9,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "4px 7px",
            borderRadius: 8,
            background: "rgba(0,0,0,.55)",
            color: "#fff",
            fontSize: 11.5,
            fontWeight: 700,
            backdropFilter: "blur(6px)",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f0b429">
              <path d="m12 2 2.9 6.3 6.8.7-5.1 4.6 1.5 6.7L12 17.6 5.9 20.9l1.5-6.7L2.3 9.6l6.8-.7z" />
            </svg>
            {item.rating}
          </span>
        )}

        {/* Title + year */}
        <div style={{ position: "absolute", left: 11, right: 11, bottom: 11 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14.5, lineHeight: 1.08, letterSpacing: "-.01em", textShadow: "0 1px 10px rgba(0,0,0,.6)" }}>
            {item.title}
          </div>
          {year && (
            <div style={{ color: "rgba(255,255,255,.72)", fontSize: 11.5, marginTop: 3 }}>{year}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

const FALLBACK_GRADIENTS = [
  "linear-gradient(158deg,#d9a05b,#5e2f1c)",
  "linear-gradient(158deg,#7a3b4a,#171029)",
  "linear-gradient(150deg,#4bb3a6,#3a2a5c)",
  "linear-gradient(158deg,#3f6fa3,#172a47)",
  "linear-gradient(158deg,#d35c84,#7a2347)",
  "linear-gradient(158deg,#c2a23a,#5c5a1f)",
];
function fallbackBg(id: number) {
  return FALLBACK_GRADIENTS[id % FALLBACK_GRADIENTS.length];
}
