import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("favorite_genres")
    .eq("id", user.id)
    .single();

  if (!profile?.favorite_genres?.length) {
    redirect("/onboarding");
  }

  redirect("/feed");
}
