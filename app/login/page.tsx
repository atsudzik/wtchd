"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const ACCENT = "#F5A623";

const POSTER_GRADIENTS = [
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
  "linear-gradient(150deg,#b0566b,#3a1822)",
  "linear-gradient(158deg,#cf7d4a,#7a2f2a)",
];

const POSTER_COLS = [0, 1, 2, 3].map((ci) => {
  const slice = Array.from(
    { length: 6 },
    (_, k) => POSTER_GRADIENTS[(ci * 3 + k) % POSTER_GRADIENTS.length]
  );
  return {
    posters: [...slice, ...slice],
    dur: `${26 + ci * 5}s`,
    dir: ci % 2 === 0 ? "normal" : "reverse",
  };
});

const FACES = [
  { initial: "А", color: "linear-gradient(150deg,#c0764b,#7a3c24)" },
  { initial: "Л", color: "linear-gradient(150deg,#5ba39a,#235447)" },
  { initial: "Д", color: "linear-gradient(150deg,#8c5a78,#43243a)" },
  { initial: "М", color: "linear-gradient(150deg,#4f6d8c,#26384d)" },
];

const TAKEN = ["admin", "artyom", "kino", "test"];

function getUsernameHint(u: string): { text: string; color: string } {
  if (!u) return { text: "", color: "" };
  if (u.length < 3) return { text: "коротко", color: "#c08a1e" };
  if (TAKEN.includes(u.toLowerCase()))
    return { text: "занят", color: "#c63d3d" };
  return { text: "✓ свободен", color: "#1f8a5b" };
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);

  const isReg = mode === "register";
  const hint = getUsernameHint(username);

  const switchMode = useCallback(
    (next: "login" | "register") => {
      setMode(next);
      setMessage(null);
    },
    []
  );

  const handleOAuth = useCallback(
    async (provider: "google" | "apple") => {
      setLoading(true);
      setMessage(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setMessage({ text: error.message, type: "error" });
        setLoading(false);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setMessage(null);
      const supabase = createClient();

      try {
        if (isReg) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { username, full_name: username },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (error) throw error;
          setMessage({
            text: "Проверь почту — мы отправили письмо для подтверждения.",
            type: "success",
          });
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
          router.push("/feed");
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Что-то пошло не так";
        setMessage({ text: msg, type: "error" });
      } finally {
        setLoading(false);
      }
    },
    [isReg, email, password, username, router]
  );

  return (
    <div
      className="cc-login-wrap"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      {/* ── LEFT: animated poster wall ── */}
      <div
        className="cc-login-left"
        style={{ background: "#15110e" }}
      >
        {/* drifting columns */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            gap: 18,
            padding: "0 24px",
            opacity: 0.92,
          }}
        >
          {POSTER_COLS.map((col, ci) => (
            <div
              key={ci}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                animation: `ccDrift ${col.dur} linear infinite`,
                animationDirection: col.dir as "normal" | "reverse",
              }}
            >
              {col.posters.map((bg, pi) => (
                <div
                  key={pi}
                  style={{
                    width: "100%",
                    aspectRatio: "2/3",
                    borderRadius: 12,
                    flexShrink: 0,
                    background: bg,
                    boxShadow: "0 14px 30px -14px rgba(0,0,0,.6)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "repeating-linear-gradient(116deg, rgba(255,255,255,.05) 0 1.5px, transparent 1.5px 9px)",
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* gradient tints */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(115deg, rgba(21,17,14,.45) 0%, rgba(21,17,14,.78) 55%, rgba(21,17,14,.95) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 90% at 18% 88%, color-mix(in srgb, ${ACCENT} 42%, transparent), transparent 55%)`,
          }}
        />

        {/* overlay text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 46,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <WchdLogo color="#fff" />
            <span
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "-.03em",
              }}
            >
              WTCHD
            </span>
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                maxWidth: 440,
                color: "#fff",
                fontWeight: 800,
                fontSize: 42,
                lineHeight: 1.04,
                letterSpacing: "-.03em",
              }}
            >
              Кино лучше, когда есть с кем его обсудить
            </h2>
            <p
              style={{
                margin: "16px 0 0",
                maxWidth: 400,
                color: "rgba(255,255,255,.78)",
                fontSize: 16,
                lineHeight: 1.55,
              }}
            >
              Трекай фильмы и сериалы, ставь оценки и следи за лентой друзей.
              Твой ежегодный Wrapped уже ждёт.
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 26,
              }}
            >
              <div style={{ display: "flex" }}>
                {FACES.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      marginRight: -9,
                      border: "2.5px solid #15110e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      background: f.color,
                    }}
                  >
                    {f.initial}
                  </div>
                ))}
              </div>
              <span
                style={{
                  color: "rgba(255,255,255,.82)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                12 000+ киноманов уже с нами
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: form ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 40px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 404 }}>
          {/* Logo — mobile only */}
          <div className="cc-login-logo" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <WchdLogo />
            <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-.03em" }}>WTCHD</span>
          </div>

          {/* tab switch */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              background: "rgba(var(--line),0.05)",
              borderRadius: 13,
              marginBottom: 28,
            }}
          >
            {(["login", "register"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1,
                    padding: 11,
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    fontSize: 14.5,
                    transition: "all .18s",
                    background: active ? "#fff" : "transparent",
                    color: active ? "#0b0f1a" : "var(--muted)",
                    boxShadow: active
                      ? "0 1px 3px rgba(28,26,23,.12)"
                      : "none",
                  }}
                >
                  {m === "login" ? "Вход" : "Регистрация"}
                </button>
              );
            })}
          </div>

          <h1
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: "-.03em",
              lineHeight: 1.05,
            }}
          >
            {isReg ? "Создай аккаунт" : "С возвращением"}
          </h1>
          <p
            style={{
              margin: "8px 0 26px",
              fontSize: 15,
              color: "var(--ink4)",
            }}
          >
            {isReg
              ? "Пара шагов — и твоя лента готова"
              : "Войди, чтобы вернуться к своей ленте"}
          </p>

          {/* OAuth */}
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <OAuthButton
              onClick={() => handleOAuth("google")}
              disabled={loading}
              dark={false}
              icon={<GoogleIcon />}
              label="Продолжить с Google"
            />
            <OAuthButton
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              dark
              icon={<AppleIcon />}
              label="Продолжить с Apple"
            />
          </div>

          {/* divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              margin: "22px 0",
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: "rgba(var(--line),0.1)",
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: "var(--muted)",
                fontWeight: 500,
              }}
            >
              или через email
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "rgba(var(--line),0.1)",
              }}
            />
          </div>

          {/* form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* username — register only */}
              {isReg && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 7 }}
                >
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink3)",
                    }}
                  >
                    Никнейм
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      border: "1.5px solid rgba(var(--line),0.14)",
                      borderRadius: 12,
                      padding: "0 14px",
                      background: "var(--surface)",
                    }}
                  >
                    <span
                      style={{ color: "var(--muted)", fontSize: 15 }}
                    >
                      @
                    </span>
                    <input
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
                        )
                      }
                      placeholder="artyom"
                      style={inputStyle}
                    />
                    {hint.text && (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                          color: hint.color,
                        }}
                      >
                        {hint.text}
                      </span>
                    )}
                  </div>
                  <span
                    style={{ fontSize: 12, color: "var(--muted)" }}
                  >
                    Это твой публичный адрес: wtchd.app/
                    {username || "artyom"}
                  </span>
                </div>
              )}

              {/* email */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
              >
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink3)",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    ...inputStyle,
                    border: "1.5px solid rgba(var(--line),0.14)",
                    borderRadius: 12,
                    padding: "13px 14px",
                    background: "var(--surface)",
                  }}
                />
              </div>

              {/* password */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink3)",
                    }}
                  >
                    Пароль
                  </label>
                  {!isReg && (
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: ACCENT,
                        cursor: "pointer",
                      }}
                    >
                      Забыли?
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  required
                  minLength={8}
                  style={{
                    ...inputStyle,
                    border: "1.5px solid rgba(var(--line),0.14)",
                    borderRadius: 12,
                    padding: "13px 14px",
                    background: "var(--surface)",
                  }}
                />
              </div>
            </div>

            {message && (
              <p
                style={{
                  margin: "14px 0 0",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background:
                    message.type === "success"
                      ? "rgba(31,138,91,.1)"
                      : "rgba(198,61,61,.1)",
                  color:
                    message.type === "success" ? "#1f8a5b" : "#c63d3d",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                width: "100%",
                padding: 15,
                borderRadius: 13,
                border: "none",
                background: ACCENT,
                color: "#17120a",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 15.5,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: `0 14px 30px -14px ${ACCENT}`,
                opacity: loading ? 0.7 : 1,
                transition: "opacity .15s",
              }}
            >
              {loading
                ? "Загрузка…"
                : isReg
                ? "Создать аккаунт"
                : "Войти"}
              {!loading && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </form>

          <p
            style={{
              margin: "22px 0 0",
              textAlign: "center",
              fontSize: 13.5,
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            {isReg ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
            <span
              onClick={() => switchMode(isReg ? "login" : "register")}
              style={{
                color: ACCENT,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isReg ? "Войти" : "Зарегистрироваться"}
            </span>
          </p>

          {isReg && (
            <p
              style={{
                margin: "18px 0 0",
                textAlign: "center",
                fontSize: 12,
                color: "var(--faint)",
                lineHeight: 1.6,
              }}
            >
              Регистрируясь, ты принимаешь Условия использования и Политику
              конфиденциальности
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared input style ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: "inherit",
  fontSize: 15,
  padding: "13px 4px",
  color: "var(--ink)",
};

// ── Small components ────────────────────────────────────────────────────────

function OAuthButton({
  onClick,
  disabled,
  dark,
  icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  dark: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 11,
        padding: 13,
        border: dark
          ? "1.5px solid transparent"
          : "1.5px solid rgba(var(--line),0.14)",
        borderRadius: 12,
        background: dark ? "#0b0f1a" : "var(--surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        fontWeight: 600,
        fontSize: 14.5,
        color: dark ? "#fff" : "var(--ink)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function WchdLogo({ color = "var(--accent)" }: { color?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 100 100"
      style={{ flexShrink: 0 }}
    >
      <line
        x1="33"
        y1="33"
        x2="67"
        y2="67"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="15" y="15" width="35" height="35" rx="9" fill={color} />
      <rect x="50" y="50" width="35" height="35" rx="9" fill={color} />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.02-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.83 1.3 10.4.86 1.25 1.89 2.66 3.23 2.61 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.28 3.13-2.54.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM14.6 4.5c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45z" />
    </svg>
  );
}
