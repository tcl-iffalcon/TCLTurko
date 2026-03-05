const fetch    = require("node-fetch");
const cache    = require("./lib/cache");
const sinewix  = require("./providers/sinewix");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
const TMDB_BASE    = "https://api.themoviedb.org/3";
const TMDB_IMG     = "https://image.tmdb.org/t/p/w500";

// TMDB item → Stremio meta (AI poster + TR bayrak)
async function tmdbToStremio(item, type, baseUrl) {
  const isMovie     = type === "movie";
  const stremioType = isMovie ? "movie" : "series";
  const title       = isMovie ? item.title : item.name;
  const releaseDate = isMovie ? item.release_date : item.first_air_date;
  const year        = releaseDate ? releaseDate.substring(0, 4) : null;
  const id          = item.imdb_id || `tmdb:${item.id}`;

  const tmdbFallback = item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null;

  // AI poster proxy — cache varsa anında, yoksa üretip döndürür
  const poster = baseUrl
    ? `${baseUrl}/ai-poster?` + new URLSearchParams({
        title:    title,
        year:     year || "",
        type:     stremioType,
        genres:   (item.genre_ids || []).join(","),
        overview: item.overview || "",
        fallback: tmdbFallback || "",
      }).toString()
    : tmdbFallback;

  // Türkçe dublaj kontrolü (Sinewix'te var mı?)
  const hasDub = await sinewix.hasTurkishDub(title, stremioType);
  const displayName = hasDub ? `🇹🇷 ${title}` : title;

  return {
    id,
    type:        stremioType,
    name:        displayName,
    poster,
    background:  item.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
      : null,
    description: item.overview,
    releaseInfo:  year,
    imdbRating:  item.vote_average ? item.vote_average.toFixed(1) : null,
    genres:      [],
    _tmdbId:     item.id,
  };
}

const MAX_CATALOG_ITEMS = 50; // Her katalog için maksimum içerik sayısı

// TMDB catalog çek
async function fetchCatalog(catalogId, type, skip = 0, baseUrl) {
  // 50 item limitini aş, boş döndür
  if (skip >= MAX_CATALOG_ITEMS) {
    console.log(`[Catalog] Limit aşıldı (skip=${skip}), boş döndürülüyor`);
    return [];
  }

  const cacheKey = `catalog:${catalogId}:${type}:${skip}`;
  const cached   = cache.get(cacheKey);
  if (cached) { console.log(`[Catalog] Cache hit: ${cacheKey}`); return cached; }

  const page     = Math.floor(skip / 20) + 1;
  const tmdbType = type === "series" ? "tv" : "movie";

  let endpoint;
  if (catalogId.includes("tr_trending")) {
    endpoint = `${TMDB_BASE}/trending/${tmdbType}/week?api_key=${TMDB_API_KEY}&page=${page}&region=TR&language=tr-TR`;
  } else if (catalogId.includes("trending")) {
    endpoint = `${TMDB_BASE}/trending/${tmdbType}/week?api_key=${TMDB_API_KEY}&page=${page}`;
  } else {
    endpoint = `${TMDB_BASE}/${tmdbType}/popular?api_key=${TMDB_API_KEY}&page=${page}`;
  }

  console.log(`[Catalog] Fetching: ${endpoint}`);

  const res  = await fetch(endpoint);
  const data = await res.json();
  if (!data.results) return [];

  // Kaç item daha alabiliriz?
  const remaining = MAX_CATALOG_ITEMS - skip;
  const filtered  = data.results
    .filter(item => item.poster_path)
    .slice(0, remaining);

  const metas = await Promise.all(
    filtered.map(item => tmdbToStremio(item, tmdbType, baseUrl))
  );

  cache.set(cacheKey, metas, 60 * 30); // 30 dakika cache
  return metas;
}

module.exports = { fetchCatalog, tmdbToStremio };
