import { NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

interface TMDBResult {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
}

async function fetchPage(path: string, mediaType: "movie" | "tv"): Promise<TMDBResult[]> {
  const res = await fetch(`${TMDB_BASE}${path}&language=ru-RU&page=1`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as TMDBResult[]).map((r) => ({ ...r, media_type: mediaType }));
}

export async function GET() {
  const [trending, popularMovies, popularTV] = await Promise.all([
    fetch(`${TMDB_BASE}/trending/all/week?language=ru-RU`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` },
      next: { revalidate: 3600 },
    }).then((r) => r.ok ? r.json().then((d) => d.results as TMDBResult[]) : []),
    fetchPage("/movie/popular?", "movie"),
    fetchPage("/tv/popular?", "tv"),
  ]);

  const seen = new Set<number>();
  const all: TMDBResult[] = [...trending, ...popularMovies, ...popularTV];

  const results = all
    .filter((r) => {
      const type = r.media_type ?? "movie";
      if (type === "person") return false;
      if (!r.poster_path) return false;
      if ((r.vote_count ?? 0) < 200) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, 20)
    .map((r) => ({
      id: r.id,
      title: r.media_type === "tv" ? r.name : r.title,
      year: (r.release_date || r.first_air_date || "").slice(0, 4),
      type: r.media_type ?? "movie",
      poster: `${IMAGE_BASE}${r.poster_path}`,
      rating: r.vote_average ?? 0,
    }));

  return NextResponse.json({ results });
}
