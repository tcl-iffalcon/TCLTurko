const { getTMDBByIMDB, getTMDBById, buildMeta } = require('../utils/tmdb');

async function metaHandler({ type, id }) {
  try {
    let tmdbData = null;

    if (id.startsWith('tt')) {
      // IMDb ID
      tmdbData = await getTMDBByIMDB(id);
      if (tmdbData) {
        const detailedType = tmdbData.media_type === 'tv' ? 'series' : 'movie';
        const detailed = await getTMDBById(tmdbData.id, detailedType);
        const meta = buildMeta(detailed || tmdbData, detailedType, id);
        if (meta) return { meta };
      }
    } else if (id.startsWith('nuvio:')) {
      const title = decodeURIComponent(id.replace('nuvio:', ''));
      const { searchTMDB } = require('../utils/tmdb');
      const found = await searchTMDB(title, type);
      if (found) {
        const detailed = await getTMDBById(found.id, type);
        const meta = buildMeta(detailed || found, type, id);
        if (meta) return { meta };
      }
      // Fallback
      return {
        meta: {
          id,
          type,
          name: title,
          description: 'Nuvio üzerinden izle'
        }
      };
    }

    return { meta: null };
  } catch (e) {
    console.error('[meta] error:', e.message);
    return { meta: null };
  }
}

module.exports = metaHandler;
