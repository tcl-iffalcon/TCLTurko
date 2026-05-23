const { searchTMDB, buildMeta } = require('../utils/tmdb');
const fullhd = require('../scrapers/fullhd');
const dizigom = require('../scrapers/dizigom');
const m3u = require('../scrapers/m3u');

async function scrapedToStremio(items, type) {
  const results = [];
  const seen = new Set();

  for (const item of items.slice(0, 40)) {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const tmdb = await searchTMDB(item.title, type);
      if (tmdb) {
        const meta = buildMeta(tmdb, type, `nuvio:${encodeURIComponent(item.title)}`);
        if (meta) {
          meta._sourceUrl = item.url;
          meta._sourcePoster = item.poster;
          results.push(meta);
          continue;
        }
      }
    } catch (e) {}

    // TMDB bulunamazsa manuel meta
    results.push({
      id: `nuvio:${encodeURIComponent(item.title)}`,
      type,
      name: item.title,
      poster: item.poster || null,
      year: item.year,
      _sourceUrl: item.url
    });
  }

  return results;
}

async function catalogHandler({ type, id, extra }) {
  const { search, genre, skip: skipStr } = extra || {};
  const skip = parseInt(skipStr) || 0;
  const page = Math.floor(skip / 20) + 1;

  try {
    // ARAMA
    if (search) {
      const [scrapeResults, m3uResults] = await Promise.allSettled([
        type === 'movie' ? fullhd.searchMovies(search) : dizigom.searchSeries(search),
        m3u.searchM3U(search)
      ]);

      const allItems = [
        ...(scrapeResults.status === 'fulfilled' ? scrapeResults.value : []),
        ...(m3uResults.status === 'fulfilled' ? m3uResults.value.slice(0, 20) : [])
      ];

      const metas = await scrapedToStremio(allItems, type);
      return { metas };
    }

    // KATEGORİ KATALOGLARI
    if (id === 'nuvio-movies-tr' || id === 'nuvio-movies-new' || id === 'nuvio-movies-popular') {
      let items = [];

      if (id === 'nuvio-movies-new') {
        items = await fullhd.getNewMovies(page);
      } else if (id === 'nuvio-movies-popular') {
        // Popular: M3U listesinden al
        const m3uItems = await m3u.getM3UPage(skip, 20);
        items = m3uItems;
      } else {
        const [scraped, m3uPage] = await Promise.allSettled([
          fullhd.getMovieList(page, genre),
          m3u.getM3UPage(skip, 10)
        ]);
        items = [
          ...(scraped.status === 'fulfilled' ? scraped.value : []),
          ...(m3uPage.status === 'fulfilled' ? m3uPage.value : [])
        ];
      }

      const metas = await scrapedToStremio(items, 'movie');
      return { metas };
    }

    if (id === 'nuvio-series-tr') {
      const items = await dizigom.getSeriesList(page, genre);
      const metas = await scrapedToStremio(items, 'series');
      return { metas };
    }

    return { metas: [] };
  } catch (e) {
    console.error('[catalog] error:', e.message);
    return { metas: [] };
  }
}

module.exports = catalogHandler;
