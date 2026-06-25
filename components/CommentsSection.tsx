"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ACCENT = "#F5A623";

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
  if (d < 7) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

interface Author {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  content: string;
  likes_count: number;
  created_at: string;
  author: Author;
  liked: boolean;
}

interface Props {
  tmdbId: number;
  mediaType: string;
  currentUserId: string | null;
}

export function CommentsSection({ tmdbId, mediaType, currentUserId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    const supabase = createClient();

    const { data: rows } = await supabase
      .from("comments")
      .select("id, content, likes_count, created_at, user_id")
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!rows || rows.length === 0) { setComments([]); setLoading(false); return; }

    const authorIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: authors } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url")
      .in("id", authorIds);
    const authorMap = new Map(authors?.map((a) => [a.id, a]) ?? []);

    // Which comments current user has liked
    let likedSet = new Set<string>();
    if (currentUserId) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", currentUserId)
        .in("comment_id", rows.map((r) => r.id));
      likedSet = new Set(likes?.map((l) => l.comment_id) ?? []);
    }

    setComments(rows.map((r) => ({
      id: r.id,
      content: r.content,
      likes_count: r.likes_count,
      created_at: r.created_at,
      author: authorMap.get(r.user_id) ?? { id: r.user_id, username: null, full_name: null, avatar_url: null },
      liked: likedSet.has(r.id),
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [tmdbId, mediaType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting || !currentUserId) return;

    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({ user_id: currentUserId, tmdb_id: tmdbId, media_type: mediaType, content: trimmed, likes_count: 0 })
      .select("id, content, likes_count, created_at, user_id")
      .single();

    setSubmitting(false);
    if (error || !data) return;

    const { data: me } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url")
      .eq("id", currentUserId)
      .single();

    setComments((prev) => [{
      id: data.id,
      content: data.content,
      likes_count: 0,
      created_at: data.created_at,
      author: me ?? { id: currentUserId, username: null, full_name: null, avatar_url: null },
      liked: false,
    }, ...prev]);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  async function toggleLike(commentId: string) {
    if (!currentUserId || likingId) return;
    setLikingId(commentId);

    // Optimistic update
    setComments((prev) => prev.map((c) =>
      c.id === commentId
        ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
        : c
    ));

    const res = await fetch(`/api/comments/${commentId}/like`, { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, liked: json.liked, likes_count: json.likes_count } : c
      ));
    } else {
      // Revert
      setComments((prev) => prev.map((c) =>
        c.id === commentId
          ? { ...c, liked: !c.liked, likes_count: c.liked ? c.likes_count - 1 : c.likes_count + 1 }
          : c
      ));
    }
    setLikingId(null);
  }

  async function deleteComment(commentId: string) {
    const supabase = createClient();
    await supabase.from("comments").delete().eq("id", commentId).eq("user_id", currentUserId!);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ margin: "0 0 20px", fontWeight: 700, fontSize: 19, letterSpacing: "-.01em" }}>
        Комментарии
        {comments.length > 0 && (
          <span style={{ marginLeft: 10, fontWeight: 600, fontSize: 15, color: "var(--muted)" }}>
            {comments.length}
          </span>
        )}
      </h2>

      {/* Input */}
      {currentUserId ? (
        <form onSubmit={submit} style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "14px 16px",
            background: "var(--surface)",
            border: "1.5px solid rgba(var(--line),0.10)",
            borderRadius: 16,
            transition: "border-color .15s",
          }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = `color-mix(in srgb, ${ACCENT} 40%, transparent)`)}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = "rgba(var(--line),0.10)")}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={autoResize}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e as never); }}
              placeholder="Напиши что думаешь о фильме…"
              maxLength={1000}
              rows={1}
              style={{
                flex: 1, border: "none", background: "transparent", outline: "none",
                fontFamily: "inherit", fontSize: 14.5, color: "var(--ink)",
                lineHeight: 1.55, resize: "none", minHeight: 24, overflow: "hidden",
              }}
            />
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              style={{
                flexShrink: 0, padding: "7px 14px", borderRadius: 10, border: "none",
                background: text.trim() ? ACCENT : "rgba(var(--line),0.08)",
                color: text.trim() ? "#0b0f1a" : "var(--faint)",
                fontFamily: "inherit", fontWeight: 700, fontSize: 13.5,
                cursor: text.trim() && !submitting ? "pointer" : "not-allowed",
                transition: "all .15s", whiteSpace: "nowrap",
              }}
            >
              {submitting ? "…" : "Отправить"}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 5, paddingLeft: 4 }}>
            ⌘Enter для отправки
          </div>
        </form>
      ) : (
        <div style={{
          padding: "14px 18px", borderRadius: 14,
          background: "var(--surface)", border: "1px solid rgba(var(--line),0.08)",
          fontSize: 14, color: "var(--muted)", marginBottom: 24,
        }}>
          <Link href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Войди</Link>
          {" "}чтобы оставить комментарий
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 76, borderRadius: 14,
              background: "var(--surface)",
              animation: "pulse 1.4s ease-in-out infinite",
            }} />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div style={{ padding: "28px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          Пока нет комментариев — будь первым
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {comments.map((c) => {
            const isOwn = c.author.id === currentUserId;
            const initial = (c.author.full_name ?? c.author.username ?? "?")[0].toUpperCase();
            return (
              <div key={c.id} style={{
                display: "flex", gap: 12, padding: "14px 16px",
                borderRadius: 14,
                background: "var(--surface)",
                border: "1px solid rgba(var(--line),0.06)",
              }}>
                {/* Avatar */}
                <Link href={c.author.username ? `/${c.author.username}` : "#"} style={{ display: "block", flexShrink: 0, textDecoration: "none" }}>
                  {c.author.avatar_url ? (
                    <img src={c.author.avatar_url} alt={c.author.full_name ?? ""} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: avatarBg(c.author.id),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 14,
                    }}>
                      {initial}
                    </div>
                  )}
                </Link>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Link
                      href={c.author.username ? `/${c.author.username}` : "#"}
                      style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", textDecoration: "none" }}
                    >
                      {c.author.full_name ?? c.author.username ?? "Пользователь"}
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>{relativeTime(c.created_at)}</span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.55, color: "var(--ink2)", wordBreak: "break-word" }}>
                    {c.content}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Like button */}
                    <button
                      onClick={() => toggleLike(c.id)}
                      disabled={!currentUserId || likingId === c.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 8, border: "none",
                        background: c.liked ? `color-mix(in srgb, #e05050 10%, var(--surface))` : "rgba(var(--line),0.06)",
                        color: c.liked ? "#e05050" : "var(--muted)",
                        fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                        cursor: currentUserId ? "pointer" : "default",
                        transition: "all .12s",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={c.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {c.likes_count > 0 && c.likes_count}
                    </button>

                    {/* Delete (own only) */}
                    {isOwn && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 10px", borderRadius: 8, border: "none",
                          background: "transparent", color: "var(--faint)",
                          fontFamily: "inherit", fontSize: 12.5,
                          cursor: "pointer", transition: "color .12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#e07070")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--faint)")}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
