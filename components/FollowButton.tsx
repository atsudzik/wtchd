"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const ACCENT = "#F5A623";

interface FollowButtonProps {
  targetUserId: string;
  initialFollowing: boolean;
}

export function FollowButton({ targetUserId, initialFollowing }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);
      setFollowing(false);
    } else {
      await Promise.all([
        supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        }),
        supabase.from("notifications").insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: "follow",
          is_read: false,
        }),
      ]);
      setFollowing(true);
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "11px 22px",
        borderRadius: 11,
        fontFamily: "inherit",
        fontWeight: 600,
        fontSize: 14,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        transition: "all .15s",
        background: following ? "var(--surface)" : ACCENT,
        color: following ? "var(--ink3)" : "#0b0f1a",
        border: following
          ? "1px solid rgba(var(--line),0.16)"
          : `1px solid ${ACCENT}`,
      }}
    >
      {following ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Подписан
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Подписаться
        </>
      )}
    </button>
  );
}
