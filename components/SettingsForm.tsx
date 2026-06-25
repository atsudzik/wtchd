"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const ACCENT = "#F5A623";

const GENRES = [
  { id: "drama",    label: "Драма" },
  { id: "thriller", label: "Триллер" },
  { id: "scifi",    label: "Фантастика" },
  { id: "comedy",   label: "Комедия" },
  { id: "horror",   label: "Ужасы" },
  { id: "doc",      label: "Документальное" },
  { id: "anime",    label: "Аниме" },
  { id: "crime",    label: "Криминал" },
  { id: "romance",  label: "Мелодрама" },
  { id: "action",   label: "Боевик" },
  { id: "fantasy",  label: "Фэнтези" },
  { id: "arthouse", label: "Артхаус" },
];

export interface ProfileData {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  favorite_genres: string[] | null;
}

export function SettingsForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [genres, setGenres] = useState<string[]>(profile.favorite_genres ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGenre(id: string) {
    setGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Файл слишком большой — максимум 5 МБ");
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload-avatar", { method: "POST", body: form });
    const json = await res.json();

    setAvatarUploading(false);

    if (!res.ok || json.error) {
      setAvatarError("Не удалось загрузить фото");
      return;
    }

    setAvatarUrl(json.url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!trimmedUsername) { setError("Username обязателен"); return; }
    if (trimmedUsername.length < 3) { setError("Username не менее 3 символов"); return; }

    setSaving(true);
    const supabase = createClient();

    if (trimmedUsername !== profile.username) {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("username", trimmedUsername);
      if ((count ?? 0) > 0) {
        setError("Этот username уже занят");
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: fullName.trim() || null,
        username: trimmedUsername,
        bio: bio.trim() || null,
        favorite_genres: genres,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      router.push(`/${trimmedUsername}`);
      router.refresh();
    }, 1200);
  }

  const initial = (profile.full_name ?? profile.username ?? "?")[0].toUpperCase();

  return (
    <form onSubmit={save} style={{ maxWidth: 560, margin: "0 auto", padding: "0 0 80px" }}>

      {/* Avatar upload */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 36 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            style={{
              width: 80, height: 80, borderRadius: "50%",
              background: avatarUrl ? "var(--surface2)" : "linear-gradient(150deg,#3f7e6e,#225447)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 30,
              overflow: "hidden",
              boxShadow: "0 8px 20px -10px rgba(0,0,0,.45)",
              border: "none",
              cursor: avatarUploading ? "wait" : "pointer",
              padding: 0,
              position: "relative",
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initial
            }
            {/* Hover overlay */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: avatarUploading
                ? "rgba(0,0,0,.45)"
                : "rgba(0,0,0,0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .15s",
            }}
              onMouseEnter={(e) => { if (!avatarUploading) (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,.40)"; }}
              onMouseLeave={(e) => { if (!avatarUploading) (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0)"; }}
            >
              {avatarUploading
                ? <Spinner />
                : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0, transition: "opacity .15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as SVGElement).style.opacity = "1"; }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )
              }
            </div>
          </button>

          {/* Camera badge */}
          {!avatarUploading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: "absolute", right: 0, bottom: 0,
                width: 26, height: 26, borderRadius: "50%",
                background: ACCENT,
                border: "2.5px solid var(--bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0b0f1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{fullName || profile.full_name || profile.username}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>@{username || profile.username}</div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            style={{
              marginTop: 8, padding: "6px 12px", borderRadius: 8,
              border: "1.5px solid rgba(var(--line),0.14)",
              background: "transparent", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 600, color: "var(--ink3)",
              cursor: avatarUploading ? "wait" : "pointer",
            }}
          >
            {avatarUploading ? "Загружаем…" : "Изменить фото"}
          </button>
          {avatarError && (
            <div style={{ fontSize: 12, color: "#e07070", marginTop: 5 }}>{avatarError}</div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={handleAvatarChange}
        />
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        <Field label="Имя">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Как тебя зовут"
            maxLength={60}
            style={inputStyle}
          />
        </Field>

        <Field label="Username">
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--muted)", fontSize: 14, fontWeight: 600, pointerEvents: "none",
            }}>@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
              placeholder="username"
              maxLength={30}
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
        </Field>

        <Field label="О себе">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Пару слов о себе и своём вкусе в кино…"
            maxLength={200}
            rows={3}
            style={{ ...inputStyle, height: "auto", resize: "none", lineHeight: 1.55, paddingTop: 12, paddingBottom: 12 }}
          />
          <div style={{ textAlign: "right", fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
            {bio.length}/200
          </div>
        </Field>

        <Field label="Тема оформления">
          <ThemeSwitcher />
        </Field>

        <Field label="Любимые жанры">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GENRES.map((g) => {
              const on = genres.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGenre(g.id)}
                  style={{
                    padding: "8px 15px", borderRadius: 10,
                    border: `1.5px solid ${on ? ACCENT : "rgba(var(--line),0.14)"}`,
                    background: on ? `color-mix(in srgb, ${ACCENT} 10%, var(--surface))` : "var(--surface2)",
                    color: on ? ACCENT : "var(--ink3)",
                    fontFamily: "inherit", fontSize: 13.5, fontWeight: 600,
                    cursor: "pointer", transition: "all .12s",
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {error && (
        <div style={{
          marginTop: 20, padding: "11px 16px", borderRadius: 11,
          background: "rgba(214,69,69,.12)", border: "1px solid rgba(214,69,69,.25)",
          color: "#e07070", fontSize: 13.5, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <button
          type="submit"
          disabled={saving || saved}
          style={{
            width: "100%", padding: "14px", borderRadius: 13, border: "none",
            background: saved ? "rgba(100,220,130,0.18)" : ACCENT,
            color: saved ? "#6fda90" : "#0b0f1a",
            fontFamily: "inherit", fontWeight: 700, fontSize: 15,
            cursor: saving || saved ? "default" : "pointer",
            opacity: saving ? 0.7 : 1, transition: "all .15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {saved ? (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Сохранено
            </>
          ) : saving ? "Сохраняем…" : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        style={{ animationName: "spin", animationDuration: "1s", animationTimingFunction: "linear", animationIterationCount: "infinite" }}
      />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "var(--ink3)", marginBottom: 8, letterSpacing: ".01em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 11,
  border: "1.5px solid rgba(var(--line),0.12)",
  background: "var(--surface)",
  fontFamily: "inherit",
  fontSize: 14.5,
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .12s",
};
