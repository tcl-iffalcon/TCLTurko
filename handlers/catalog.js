const { searchTMDB, buildMeta, cleanTitle } = require('../utils/tmdb');
const fullhd = require('../scrapers/fullhd');
const dizigom = require('../scrapers/dizigom');
const m3u = require('../scrapers/m3u');

// Tek bir item'ı Stremio meta'ya dönüştür
// requirePoster=true ise poster yoksa null döner (katalogdan çıkarılır)
async function itemToMeta(item, type, requirePoster = true) {
  try {
    const tmdb = await searchTMDB(item.title, type, item.year);
    if (tmdb) {
      const meta = buildMeta(tmdb, type, `nuvio:${encodeURIComponent(item.title)}`);
      if (meta) {
        // Poster yoksa ve zorunluysa atla
        if (requirePoster && !meta.poster) return null;
        meta._sourceUrl = item.url;
        return meta;
      }
    }
  } catch (e) {}

  // TMDB bulunamadı — scraper poster'ı varsa kullan
  if (item.poster && item.poster.startsWith('http')) {
    return {
      id: `nuvio:${encodeURIComponent(item.title)}`,
      type,
      name: item.title,
      poster: item.poster,
      year: item.year,
      _sourceUrl: item.url
    };
  }

  // Poster yok, requirePoster=true ise kataloğa ekleme
  if (requirePoster) return null;

  return {
    id: `nuvio:${encodeURIComponent(item.title)}`,
    type,
    name: item.title,
    poster: null,
    year: item.year,
    _sourceUrl: item.url
  };
}

// Paralel TMDB araması — limit kadar item işle, en az targetCount poster'lı sonuç topla
async function scrapedToStremio(items, type, targetCount = 20) {
  const results = [];
  const seen = new Set();

  // Önce duplikasyonları temizle
  const unique = items.filter(item => {
    const key = cleanTitle(item.title).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 5'erli batch'ler halinde işle (API rate limit'e takılmamak için)
  const BATCH = 5;
  for (let i = 0; i < unique.length && results.length < targetCount; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(item => itemToMeta(item, type, true))
    );
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }
  }

  return results;
}

async function catalogHandler({ type, id, extra }) {
  const { search, genre, skip: skipStr } = extra || {};
  const skip = parseInt(skipStr) || 0;
  const page = Math.floor(skip / 20) + 1;

  try {
    // ── ARAMA ──────────────────────────────────────────────────────────────
    if (search) {
      const [scrapeRes, m3uRes] = await Promise.allSettled([
        type === 'movie' ? fullhd.searchMovies(search) : dizigom.searchSeries(search),
        m3u.searchM3U(search)
      ]);

      const allItems = [
        ...(scrapeRes.status === 'fulfilled' ? scrapeRes.value : []),
        ...(m3uRes.status === 'fulfilled' ? m3uRes.value.slice(0, 20) : [])
      ];

      // Arama sonuçlarında poster zorunluluğu yok (kullanıcı spesifik arıyor)
      const seen = new Set();
      const unique = allItems.filter(item => {
        const key = cleanTitle(item.title).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const metaPromises = unique.slice(0, 30).map(item => itemToMeta(item, type, false));
      const settled = await Promise.allSettled(metaPromises);
      const metas = settled
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      return { metas };
    }

    // ── YENİ FİLMLER ────────────────────────────────────────────────────────
    if (id === 'nuvio-movies-new') {
      // Daha fazla item çek, poster yokları zaten filtreler
      const items = await fullhd.getNewMovies(page);
      const metas = await scrapedToStremio(items, 'movie', 20);
      return { metas };
    }

    // ── POPÜLER FİLMLER (M3U tabanlı) ───────────────────────────────────────
    if (id === 'nuvio-movies-popular') {
      // M3U'dan daha fazla item al çünkü birçoğu poster bulamayacak
      const m3uItems = await m3u.getM3UPage(skip, 60);
      const metas = await scrapedToStremio(m3uItems, 'movie', 20);
      return { metas };
    }

    // ── ANA FİLM KATALOĞU ───────────────────────────────────────────────────
    if (id === 'nuvio-movies-tr') {
      const [scraped, m3uPage] = await Promise.allSettled([
        fullhd.getMovieList(page, genre),
        // M3U'dan da ekle ama skip'i farklı bir offset'te tut
        m3u.getM3UPage(skip * 2, 30)
      ]);

      const items = [
        ...(scraped.status === 'fulfilled' ? scraped.value : []),
        ...(m3uPage.status === 'fulfilled' ? m3uPage.value : [])
      ];

      const metas = await scrapedToStremio(items, 'movie', 20);
      return { metas };
    }

    // ── DİZİ KATALOĞU ───────────────────────────────────────────────────────
    if (id === 'nuvio-series-tr') {
      const items = await dizigom.getSeriesList(page, genre);
      const metas = await scrapedToStremio(items, 'series', 20);
      return { metas };
    }

    return { metas: [] };
  } catch (e) {
    console.error('[catalog] error:', e.message);
    return { metas: [] };
  }
}

module.exports = catalogHandler;
