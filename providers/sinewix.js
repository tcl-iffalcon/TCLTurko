const fetch   = require("node-fetch");
const cache   = require("../lib/cache");

const BASE_URL     = "https://sinewix.onrender.com";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";

// TMDB'den hem Türkçe hem orijinal başlık al
async function getTitlesFromTmdb(tmdbId, mediaType) {
  const cacheKey = `sinewix-titles:${mediaType}:${tmdbId}`;
  const cached   = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const tmdbType = mediaType === "movie" ? "movie" : "tv";

    // Türkçe başlık
    const trRes  = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?language=tr-TR&api_key=${TMDB_API_KEY}`,
      { timeout: 8000 }
    );
    const trData  = await trRes.json();
    const trTitle = trData.title || trData.name || null;

    // Orijinal başlık
    const enRes  = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?language=en-US&api_key=${TMDB_API_KEY}`,
      { timeout: 8000 }
    );
    const enData  = await enRes.json();
    const enTitle = enData.title || enData.name || null;
    const origTitle = enData.original_title || enData.original_name || null;

    // Tekrarları kaldır
    const titles = [...new Set([trTitle, enTitle, origTitle].filter(Boolean))];

    cache.set(cacheKey, titles, 86400);
    return titles;
  } catch (err) {
    console.error("[Sinewix] TMDB error:", err.message);
    return [];
  }
}

// Sinewix'te arama + stream (tek başlık için)
async function searchAndStream(title, sinewixType, season, episode) {
  const catalogId = sinewixType === "movie" ? "sinewix-movies" : "sinewix-series";
  const searchUrl = `${BASE_URL}/catalog/${sinewixType}/${catalogId}/search=${encodeURIComponent(title)}.json`;
  console.log("[Sinewix] Search:", searchUrl);

  try {
    const res  = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      timeout: 15000,
    });
    const data = await res.json();
    if (!data?.metas?.length) {
      console.log("[Sinewix] Sonuç yok:", title);
      return null; // null = bulunamadı, [] = bulundu ama stream yok
    }

    const sinewixId = data.metas[0].id;
    const streamId  = sinewixType === "movie"
      ? sinewixId
      : `${sinewixId}:${season}:${episode}`;
    const streamUrl = `${BASE_URL}/stream/${sinewixType}/${streamId}.json`;
    console.log("[Sinewix] Stream:", streamUrl);

    const sRes  = await fetch(streamUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      timeout: 15000,
    });
    const sData = await sRes.json();
    if (!sData?.streams?.length) {
      console.log("[Sinewix] Stream bulunamadı");
      return [];
    }

    return sData.streams
      .filter(s => s.url)
      .map(s => ({
        name:    "🇹🇷 Sinewix",
        title:   s.title || "Sinewix TR",
        url:     s.url,
        quality: s.quality || "HD",
        headers: { Referer: BASE_URL, "User-Agent": "Mozilla/5.0" },
      }));
  } catch (err) {
    console.error("[Sinewix] Error:", err.message);
    return null;
  }
}

// Tüm başlıkları sırayla dene, ilk sonucu döndür
async function searchWithFallback(titles, sinewixType, season, episode) {
  for (const title of titles) {
    const result = await searchAndStream(title, sinewixType, season, episode);
    if (result !== null) return result; // null = bulunamadı, devam et
  }
  return [];
}

// Stream getir
async function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[Sinewix] Fetching:", mediaType, tmdbId, season, episode);
  const sinewixType = mediaType === "movie" ? "movie" : "series";
  const titles = await getTitlesFromTmdb(tmdbId, mediaType);
  if (!titles.length) return [];
  return searchWithFallback(titles, sinewixType, season, episode);
}

// Türkçe dublaj var mı? (catalog için bayrak kontrolü)
async function hasTurkishDub(name, type) {
  const cacheKey = `sinewix-dub:${type}:${name}`;
  const cached   = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const sinewixType = type === "movie" ? "movie" : "series";
    const catalogId   = type === "movie" ? "sinewix-movies" : "sinewix-series";
    const url = `${BASE_URL}/catalog/${sinewixType}/${catalogId}/search=${encodeURIComponent(name)}.json`;
    const res  = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      timeout: 10000,
    });
    const data   = await res.json();
    const result = !!(data?.metas?.length);
    console.log(`[DUB] "${name}" → Sinewix: ${result ? "🇹🇷 VAR" : "❌ YOK"}`);
    cache.set(cacheKey, result, 43200);
    return result;
  } catch (err) {
    console.error("[Sinewix] Dub check error:", err.message);
    cache.set(cacheKey, false, 3600);
    return false;
  }
}

module.exports = { getStreams, hasTurkishDub };
