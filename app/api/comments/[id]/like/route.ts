import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: commentId } = await params;

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await admin
    .from("comment_likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("comment_id", commentId)
    .maybeSingle();

  let liked: boolean;

  if (existing) {
    await admin.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", commentId);
    liked = false;
  } else {
    await admin.from("comment_likes").insert({ user_id: user.id, comment_id: commentId });
    liked = true;

    // Notify comment author (skip if own comment)
    const { data: comment } = await admin
      .from("comments")
      .select("user_id, tmdb_id, media_type")
      .eq("id", commentId)
      .single();
    if (comment && comment.user_id !== user.id) {
      await admin.from("notifications").insert({
        user_id: comment.user_id,
        actor_id: user.id,
        type: "like",
        tmdb_id: comment.tmdb_id,
        media_type: comment.media_type,
        is_read: false,
      });
    }
  }

  // Sync likes_count from actual count
  const { count } = await admin
    .from("comment_likes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId);
  await admin.from("comments").update({ likes_count: count ?? 0 }).eq("id", commentId);

  return NextResponse.json({ liked, likes_count: count ?? 0 });
}
