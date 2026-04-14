interface Movie {
  adult: boolean;
  backdrop_path: 'string';
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string | null;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export async function searchMovies(title: string): Promise<Movie | null> {
  // Guard
  if (!process.env.TMDB_API_KEY) return null;

  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const options = { method: 'GET', headers: { accept: 'application/json' } };
  const res = await fetch(url, options);
  const data = await res.json();
  return data.results?.[0] ?? null;
}

export function generateFullPosterPath(poster_path: string) {
  return `https://image.tmdb.org/t/p/w500${poster_path}`;
}
