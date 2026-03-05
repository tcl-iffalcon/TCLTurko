const fetch   = require("node-fetch");
const cache   = require("./lib/cache");
const sinewix = require("./providers/sinewix");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
const TMDB_BASE    = "https://api.themoviedb.org/3";
const TMDB_IMG     = "https://image.tmdb.org/t/p/w500";

async function fetchMeta(id, type, baseUrl) {
  const cacheKey = `meta:${type}:${id}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const isMovie  = type === "movie";
    const tmdbType = isMovie ? "movie" : "tv";
    let tmdbId     = null;

    // ID çöz
    if (id.startsWith("tt")) {
      const res  = await fetch(
        `${TMDB_BASE}/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`,
        { timeout: 8000 }
      );
      const data    = await res.json();
      const results = isMovie ? data.movie_results : data.tv_results;
      if (!results?.length) return null;
      tmdbId = results[0].id;
    } else if (id.startsWith("tmdb:")) {
      tmdbId = id.replace("tmdb:", "");
    } else {
      return null;
    }

    // TMDB detay
    const res  = await fetch(
      `${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`,
      { timeout: 8000 }
    );
    const item = await res.json();

    const title       = isMovie ? item.title : item.name;
    const releaseDate = isMovie ? item.release_date : item.first_air_date;
    const year        = releaseDate ? releaseDate.substring(0, 4) : null;
    const imdbId      = item.external_ids?.imdb_id || id;
    const tmdbFallback = item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null;

    // AI poster
    const poster = baseUrl
      ? `${baseUrl}/ai-poster?` + new URLSearchParams({
          title:    title,
          year:     year || "",
          type,
          genres:   (item.genres || []).map(g => g.id).join(","),
          overview: item.overview || "",
          fallback: tmdbFallback || "",
          tmdbId:   String(tmdbId || ""),
        }).toString()
      : tmdbFallback;

    // TR dublaj kontrolü
    const hasDub      = await sinewix.hasTurkishDub(title, type);
    const displayName = hasDub ? `🇹🇷 ${title}` : title;
    const dubDesc     = hasDub
      ? `🇹🇷 Bu içerik Türkçe dublaj ile mevcut.\n\n${item.overview || ""}`
      : item.overview || "";

    const meta = {
      id:          imdbId,
      type,
      name:        displayName,
      poster,
      background:  item.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
        : null,
      description: dubDesc,
      releaseInfo:  year,
      imdbRating:  item.vote_average ? item.vote_average.toFixed(1) : null,
      genres:      (item.genres || []).map(g => g.name),
      runtime:     isMovie
        ? (item.runtime ? `${item.runtime} dk` : null)
        : (item.episode_run_time?.[0] ? `${item.episode_run_time[0]} dk` : null),
    };

    cache.set(cacheKey, meta, 60 * 10); // 10 dakika
    return meta;
  } catch (err) {
    console.error(`[Meta] Error (${id}):`, err.message);
    return null;
  }
}

module.exports = { fetchMeta };
