const cheerio = require('cheerio');
const { fetchWithCache } = require('../utils/http');

const BASE = 'https://www.fullhdfilmizlesene.life';

async function getMovieList(page = 1, genre = null) {
  try {
    let url = genre
      ? `${BASE}/tur/${encodeURIComponent(genre)}/page/${page}`
      : `${BASE}/filmler/page/${page}`;
    const html = await fetchWithCache(url, {
      headers: { Referer: BASE }
    }, 1800);
    const $ = cheerio.load(html);
    const results = [];

    $('.movies-list .ml-item, .film-list .item, article.post').each((i, el) => {
      const $el = $(el);
      const title = $el.find('.mli-info h2, .movie-title, h2.entry-title').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      const poster = $el.find('img').first().attr('data-original') || $el.find('img').first().attr('src') || '';
      const year = $el.find('.mli-quality, .year, .movie-year').first().text().match(/\d{4}/)?.[0];
      const rating = $el.find('.mli-score, .imdb-rating').first().text().trim();

      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
          poster,
          year: year ? parseInt(year) : null,
          rating: parseFloat(rating) || null,
          source: 'fullhdfilmizlesene'
        });
      }
    });

    return results;
  } catch (e) {
    console.error('[fullhdfilmizlesene] list error:', e.message);
    return [];
  }
}

async function getNewMovies(page = 1) {
  try {
    const url = `${BASE}/page/${page}`;
    const html = await fetchWithCache(url, { headers: { Referer: BASE } }, 900);
    const $ = cheerio.load(html);
    const results = [];

    $('.movies-list .ml-item, article.post').each((i, el) => {
      const $el = $(el);
      const title = $el.find('.mli-info h2, h2.entry-title').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      const poster = $el.find('img').first().attr('data-original') || $el.find('img').first().attr('src') || '';
      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
          poster,
          source: 'fullhdfilmizlesene'
        });
      }
    });

    return results;
  } catch (e) {
    console.error('[fullhdfilmizlesene] new error:', e.message);
    return [];
  }
}

async function searchMovies(query) {
  try {
    const url = `${BASE}/?s=${encodeURIComponent(query)}`;
    const html = await fetchWithCache(url, { headers: { Referer: BASE } }, 1800);
    const $ = cheerio.load(html);
    const results = [];

    $('.movies-list .ml-item, article.post').each((i, el) => {
      const $el = $(el);
      const title = $el.find('.mli-info h2, h2.entry-title').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      const poster = $el.find('img').first().attr('data-original') || $el.find('img').first().attr('src') || '';
      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
          poster,
          source: 'fullhdfilmizlesene'
        });
      }
    });

    return results;
  } catch (e) {
    console.error('[fullhdfilmizlesene] search error:', e.message);
    return [];
  }
}

async function getStreams(pageUrl) {
  try {
    const html = await fetchWithCache(pageUrl, { headers: { Referer: BASE } }, 1800);
    const $ = cheerio.load(html);
    const streams = [];

    // iframe kaynaklarını çek
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && (src.includes('rapidvid') || src.includes('vidmoxy') || src.includes('trplayer') || src.includes('sobreats'))) {
        streams.push({ embedUrl: src.startsWith('//') ? `https:${src}` : src, quality: 'HD' });
      }
    });

    // Script içindeki player URL'lerini ara
    $('script').each((i, el) => {
      const txt = $(el).html() || '';
      const matches = txt.match(/(?:file|source|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)/g) || [];
      matches.forEach(m => {
        const url = m.match(/["']([^"']+\.m3u8[^"']*)/)?.[1];
        if (url) streams.push({ url, quality: 'HD', type: 'hls' });
      });
    });

    return streams;
  } catch (e) {
    console.error('[fullhdfilmizlesene] stream error:', e.message);
    return [];
  }
}

module.exports = { getMovieList, getNewMovies, searchMovies, getStreams };
