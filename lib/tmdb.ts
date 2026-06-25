const TMDB_BASE = "https://api.themoviedb.org/3";
export const IMG_BASE = "https://image.tmdb.org/t/p";

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface MediaDetail {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  genres: string[];
  runtime: number | null;
  imdb_id: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  cast_main: CastMember[];
  director: string | null;
  countries: string[];
}

function tmdbHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export async function fetchMediaDetail(
  type: "movie" | "tv",
  id: number
): Promise<MediaDetail | null> {
  const appendTo =
    type === "movie"
      ? "credits,external_ids,release_dates"
      : "aggregate_credits,external_ids,content_ratings";

  const res = await fetch(
    `${TMDB_BASE}/${type}/${id}?append_to_response=${appendTo}&language=ru-RU`,
    {
      headers: tmdbHeaders(),
      next: { revalidate: 86400 },
    }
  );

  if (!res.ok) return null;
  const d = await res.json();

  let director: string | null = null;
  let cast: CastMember[] = [];

  if (type === "movie") {
    director =
      (d.credits?.crew as { job: string; name: string }[])?.find(
        (c) => c.job === "Director"
      )?.name ?? null;
    cast = (
      (d.credits?.cast as {
        id: number;
        name: string;
        character: string;
        profile_path: string | null;
      }[]) ?? []
    )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
      }));
  } else {
    director =
      (
        d.created_by as { name: string }[] | undefined
      )
        ?.map((c) => c.name)
        .join(", ") ?? null;
    cast = (
      (d.aggregate_credits?.cast as {
        id: number;
        name: string;
        roles: { character: string }[];
        profile_path: string | null;
      }[]) ?? []
    )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        character: c.roles?.[0]?.character ?? "",
        profile_path: c.profile_path,
      }));
  }

  const imdb_id: string | null = d.external_ids?.imdb_id ?? null;

  const releaseDate: string | null =
    type === "movie"
      ? (d.release_date as string) || null
      : (d.first_air_date as string) || null;

  const runtime: number | null =
    type === "movie"
      ? (d.runtime as number) || null
      : ((d.episode_run_time as number[]) ?? [])[0] ?? null;

  const countries: string[] =
    (
      d.production_countries as { iso_3166_1: string; name: string }[]
    )?.map((c) => c.iso_3166_1) ?? [];

  return {
    tmdb_id: id,
    media_type: type,
    title: (d.title as string) ?? (d.name as string) ?? "",
    original_title:
      (d.original_title as string) ?? (d.original_name as string) ?? "",
    overview: (d.overview as string) ?? "",
    poster_path: (d.poster_path as string) ?? null,
    backdrop_path: (d.backdrop_path as string) ?? null,
    release_date: releaseDate,
    genres: (
      d.genres as { id: number; name: string }[]
    )?.map((g) => g.name) ?? [],
    runtime,
    imdb_id,
    imdb_rating: null,
    imdb_votes: null,
    cast_main: cast,
    director,
    countries,
  };
}

export async function fetchOMDbRating(
  imdbId: string
): Promise<{ rating: number; votes: number } | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;

  const res = await fetch(
    `https://www.omdbapi.com/?apikey=${key}&i=${imdbId}&r=json`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const d = await res.json();
  if (d.Response === "False") return null;

  const rating = parseFloat(d.imdbRating);
  const votes = parseInt((d.imdbVotes as string)?.replace(/,/g, "") ?? "0", 10);
  if (isNaN(rating)) return null;

  return { rating, votes };
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}
