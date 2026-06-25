"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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

export interface Friend {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface RecommendModalProps {
  tmdbId: number;
  mediaType: string;
  title: string;
  posterUrl: string | null;
  friends: Friend[];
}

export function RecommendModal({ tmdbId, mediaType, title, posterUrl, friends }: RecommendModalProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function send() {
    if (!selected || sending) return;
    setSending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    await Promise.all([
      supabase.from("recommendations").insert({
        from_user_id: user.id,
        to_user_id: selected,
        tmdb_id: tmdbId,
        media_type: mediaType,
        message: message.trim() || null,
        is_read: false,
      }),
      supabase.from("notifications").insert({
        user_id: selected,
        actor_id: user.id,
        type: "recommendation",
        tmdb_id: tmdbId,
        media_type: mediaType,
        is_read: false,
      }),
    ]);

    setSending(false);
    setSent(true);
    setTimeout(() => {
      setOpen(false);
      setSent(false);
      setSelected(null);
      setMessage("");
    }, 1800);
  }

  const selectedFriend = friends.find((f) => f.id === selected);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 18px",
          borderRadius: 11,
          fontFamily: "inherit",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          background: "rgba(255,255,255,0.14)",
          color: "rgba(255,255,255,0.88)",
          border: "1.5px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(6px)",
          transition: "all .15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Посоветовать
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{
            background: "var(--surface)",
            borderRadius: 20,
            width: "100%",
            maxWidth: 440,
            boxShadow: "0 32px 64px -24px rgba(0,0,0,.6)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ padding: "22px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-.02em" }}>Посоветовать другу</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>«{title}»</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex", borderRadius: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Poster preview */}
            {posterUrl && (
              <div style={{ padding: "16px 24px 0", display: "flex", gap: 12, alignItems: "center" }}>
                <img src={posterUrl} alt={title} style={{ width: 42, height: 62, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.4 }}>
                  Выбери друга, которому хочешь порекомендовать этот{mediaType === "tv" ? " сериал" : " фильм"}.
                </div>
              </div>
            )}

            {/* Friends list */}
            <div style={{ padding: "16px 24px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
                Твои друзья
              </div>
              {friends.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
                  Пока нет подписок — подпишись на кого-нибудь
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                  {friends.map((f) => {
                    const on = selected === f.id;
                    const initial = (f.full_name ?? f.username ?? "?")[0].toUpperCase();
                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelected(on ? null : f.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: `1.5px solid ${on ? ACCENT : "rgba(var(--line),0.10)"}`,
                          background: on ? `color-mix(in srgb, ${ACCENT} 8%, var(--surface))` : "transparent",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                          transition: "all .12s",
                        }}
                      >
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt={f.full_name ?? ""} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: avatarBg(f.id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                            {initial}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {f.full_name ?? f.username}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>@{f.username}</div>
                        </div>
                        {on && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message input */}
            {selected && (
              <div style={{ padding: "14px 24px 0" }}>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Добавь сообщение для ${selectedFriend?.full_name ?? selectedFriend?.username ?? "друга"}…`}
                  maxLength={200}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: 11,
                    border: "1.5px solid rgba(var(--line),0.12)",
                    background: "var(--surface2)",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "var(--ink)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* Send button */}
            <div style={{ padding: "16px 24px 22px" }}>
              {sent ? (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  padding: "13px",
                  borderRadius: 12,
                  background: `color-mix(in srgb, ${ACCENT} 12%, var(--surface))`,
                  color: ACCENT,
                  fontWeight: 700,
                  fontSize: 15,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Рекомендация отправлена!
                </div>
              ) : (
                <button
                  onClick={send}
                  disabled={!selected || sending}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 12,
                    border: "none",
                    background: selected ? ACCENT : "rgba(var(--line),0.08)",
                    color: selected ? "#0b0f1a" : "var(--faint)",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: selected && !sending ? "pointer" : "not-allowed",
                    opacity: sending ? 0.7 : 1,
                    transition: "all .15s",
                  }}
                >
                  {sending ? "Отправляем…" : "Отправить рекомендацию"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
