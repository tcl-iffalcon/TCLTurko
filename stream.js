
const fetch   = require("node-fetch");
const sinewix = require("./providers/sinewix");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
const TMDB_BASE    = "https://api.themoviedb.org/3";

async function resolveTmdbId(id, type) {
  const isMovie = type === "movie";
  if (id.startsWith("tt")) {
    const res     = await fetch(
      `${TMDB_BASE}/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`,
      { timeout: 8000 }
    );
    const data    = await res.json();
    const results = isMovie ? data.movie_results : data.tv_results;
    if (!results?.length) return null;
    return results[0].id;
  }
  if (id.startsWith("tmdb:")) return id.replace("tmdb:", "");
  return null;
}

async function fetchStreams(id, type) {
  const isMovie = type === "movie";
  let seasonNum  = null;
  let episodeNum = null;

  if (!isMovie && id.includes(":")) {
    const parts = id.split(":");
    id         = parts[0];
    seasonNum  = parseInt(parts[1]);
    episodeNum = parseInt(parts[2]);
  }

  const tmdbId = await resolveTmdbId(id, type);
  if (!tmdbId) {
    console.log(`[Stream] TMDB ID çözümlenemedi: ${id}`);
    return [];
  }

  const mediaType = isMovie ? "movie" : "tv";
  console.log(`[Stream] TMDB ${tmdbId} | ${mediaType}${seasonNum ? ` S${seasonNum}E${episodeNum}` : ""}`);

  const streams = await sinewix.getStreams(tmdbId, mediaType, seasonNum, episodeNum);
  console.log(`[Stream] Toplam: ${streams.length} stream`);

  return streams.map(s => ({
    name:  s.name  || "🇹🇷 Sinewix",
    title: s.title || "",
    url:   s.url,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: s.headers || {},
      },
    },
  }));
}

module.exports = { fetchStreams };
