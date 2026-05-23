const { getTMDBByIMDB } = require('../utils/tmdb');
const fullhd = require('../scrapers/fullhd');
const dizigom = require('../scrapers/dizigom');
const m3u = require('../scrapers/m3u');
const { fetchWithCache } = require('../utils/http');

// Embed URL'den direkt stream çıkarmaya çalış
async function resolveEmbed(embedUrl) {
  try {
    const html = await fetchWithCache(embedUrl, {
      headers: {
        Referer: embedUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, 900);

    const streams = [];
    const txt = typeof html === 'string' ? html : JSON.stringify(html);

    // M3U8 ara
    const m3u8Matches = txt.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g) || [];
    m3u8Matches.forEach(url => {
      streams.push({ url, type: 'hls', quality: 'HD' });
    });

    // MP4 ara
    const mp4Matches = txt.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g) || [];
    mp4Matches.forEach(url => {
      streams.push({ url, type: 'mp4', quality: 'HD' });
    });

    return streams;
  } catch (e) {
    return [];
  }
}

async function streamHandler({ type, id }) {
  const streams = [];

  try {
    let title = null;

    // IMDb ID ise TMDB'den başlık al
    if (id.startsWith('tt')) {
      const tmdb = await getTMDBByIMDB(id);
      if (tmdb) title = tmdb.title || tmdb.name;
    } else if (id.startsWith('nuvio:')) {
      title = decodeURIComponent(id.replace('nuvio:', ''));
    }

    if (!title) return { streams: [] };

    // 1. M3U listesinden stream al
    const m3uStreams = await m3u.getM3UStreams(title);
    streams.push(...m3uStreams.slice(0, 5));

    // 2. Web scraper ile stream al
    if (type === 'movie') {
      const searchResults = await fullhd.searchMovies(title);
      if (searchResults.length > 0) {
        const embedStreams = await fullhd.getStreams(searchResults[0].url);
        for (const es of embedStreams.slice(0, 3)) {
          if (es.url) {
            streams.push({
              url: es.url,
              title: `🎬 Nuvio - Kaynak 1`,
              behaviorHints: { notWebReady: false }
            });
          } else if (es.embedUrl) {
            // Embed'i çözmeye çalış
            const resolved = await resolveEmbed(es.embedUrl);
            resolved.slice(0, 2).forEach((rs, idx) => {
              streams.push({
                url: rs.url,
                title: `🎬 Nuvio - Alternatif ${idx + 1}`,
                behaviorHints: { notWebReady: false }
              });
            });
          }
        }
      }
    } else if (type === 'series') {
      // Dizi için bölüm URL'si çıkar
      const searchResults = await dizigom.searchSeries(title);
      if (searchResults.length > 0) {
        const episodes = await dizigom.getEpisodes(searchResults[0].url);
        if (episodes.length > 0) {
          const epStreams = await dizigom.getStreams(episodes[0].url);
          epStreams.slice(0, 3).forEach((es, idx) => {
            if (es.embedUrl) {
              streams.push({
                externalUrl: es.embedUrl,
                title: `📺 Nuvio Dizi - Kaynak ${idx + 1}`,
                behaviorHints: { notWebReady: true }
              });
            }
          });
        }
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const unique = streams.filter(s => {
      const key = s.url || s.externalUrl || '';
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[stream] "${title}" için ${unique.length} stream bulundu`);
    return { streams: unique };
  } catch (e) {
    console.error('[stream] error:', e.message);
    return { streams: [] };
  }
}

module.exports = streamHandler;
