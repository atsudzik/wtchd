import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  const res = await fetch(
    `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&language=ru-RU&page=1&include_adult=false`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ results: [] }, { status: res.status });
  }

  const data = await res.json();

  const results = (data.results as TMDBResult[])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      title: r.media_type === "movie" ? r.title : r.name,
      year: (r.release_date || r.first_air_date || "").slice(0, 4),
      type: r.media_type,
      poster: r.poster_path
        ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
        : null,
      rating: r.vote_average ?? 0,
    }));

  return NextResponse.json({ results });
}

interface TMDBResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}
