"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const ACCENT = "#F5A623";

type Status = "want" | "watching" | "watched" | null;

interface FilmActionsProps {
  tmdbId: number;
  mediaType: string;
  initialStatus: Status;
  initialRating: number | null;
}

export function FilmActions({
  tmdbId,
  mediaType,
  initialStatus,
  initialRating,
}: FilmActionsProps) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleStatus(newStatus: Status) {
    if (saving) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (newStatus === status) {
      await supabase
        .from("watched")
        .delete()
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType);
      setStatus(null);
    } else {
      await supabase.from("watched").upsert(
        {
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: mediaType,
          status: newStatus,
          rating: rating > 0 ? rating : null,
          watched_at: newStatus === "watched" ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,tmdb_id,media_type" }
      );
      setStatus(newStatus);

      // Notify followers when marking as watched
      if (newStatus === "watched" && status !== "watched") {
        const { data: followers } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", user.id);
        if (followers && followers.length > 0) {
          await supabase.from("notifications").insert(
            followers.map((f) => ({
              user_id: f.follower_id,
              actor_id: user.id,
              type: "watched",
              tmdb_id: tmdbId,
              media_type: mediaType,
              is_read: false,
            }))
          );
        }
      }
    }
    setSaving(false);
    router.refresh();
  }

  async function handleRating(newRating: number) {
    setRating(newRating);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (status) {
      await supabase
        .from("watched")
        .update({ rating: newRating })
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", mediaType);
    }
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 18px",
    borderRadius: 11,
    fontFamily: "inherit",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    backdropFilter: "blur(6px)",
    transition: "all .15s",
  };

  function btnStyle(s: Status): React.CSSProperties {
    const active = status === s;
    return {
      ...btnBase,
      background: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.14)",
      color: active ? "#0b0f1a" : "rgba(255,255,255,0.88)",
      border: active ? "1.5px solid rgba(255,255,255,0.9)" : "1.5px solid rgba(255,255,255,0.22)",
    };
  }

  return (
    <div>
      {/* Status buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <button onClick={() => handleStatus("want")} style={btnStyle("want")} disabled={saving}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          Хочу посмотреть
        </button>
        <button onClick={() => handleStatus("watching")} style={btnStyle("watching")} disabled={saving}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" fill="currentColor" />
          </svg>
          Смотрю сейчас
        </button>
        <button onClick={() => handleStatus("watched")} style={btnStyle("watched")} disabled={saving}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Посмотрел
        </button>
      </div>

      {/* My rating (shown when has status) */}
      {status && (
        <div style={{
          background: "#0b0f1a",
          borderRadius: 16,
          padding: "18px 20px",
          color: "#fff",
          display: "inline-flex",
          flexDirection: "column",
          gap: 10,
          minWidth: 200,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "#bdb6aa" }}>
            Твоя оценка
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 34, lineHeight: 0.9, letterSpacing: "-.02em", color: rating ? ACCENT : "#fff" }}>
              {rating || "—"}
            </span>
            <span style={{ fontSize: 14, color: "#8e887e", fontWeight: 700 }}>/10</span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                onClick={() => handleRating(i + 1)}
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 2,
                  cursor: "pointer",
                  background: i < rating ? ACCENT : "rgba(255,255,255,.12)",
                  transition: "background .1s",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
