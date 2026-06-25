"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function MarkAllRead({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handle() {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      style={{
        padding: "9px 16px",
        border: "1px solid rgba(var(--line),0.12)",
        borderRadius: 10,
        background: "var(--surface)",
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--ink3)",
        whiteSpace: "nowrap",
        opacity: loading ? 0.6 : 1,
      }}
    >
      Прочитать все
    </button>
  );
}
