"use client";

import { useState } from "react";

interface ShareButtonProps {
  title: string;
  url: string;
}

export function ShareButton({ title, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const shareData = {
      title,
      text: `Посмотри «${title}» — рекомендую!`,
      url,
    };

    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or not supported — fallback to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard also not available — nothing to do
    }
  }

  return (
    <button
      onClick={share}
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
        background: copied ? "rgba(100,220,130,0.18)" : "rgba(255,255,255,0.14)",
        color: copied ? "#6fda90" : "rgba(255,255,255,0.88)",
        border: `1.5px solid ${copied ? "rgba(100,220,130,0.35)" : "rgba(255,255,255,0.22)"}`,
        backdropFilter: "blur(6px)",
        transition: "all .15s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Ссылка скопирована
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Поделиться
        </>
      )}
    </button>
  );
}
