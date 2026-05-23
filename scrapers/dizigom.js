const cheerio = require('cheerio');
const { fetchWithCache } = require('../utils/http');

const BASE = 'https://www.dizigom5.com';

async function getSeriesList(page = 1, genre = null) {
  try {
    let url = genre
      ? `${BASE}/tur/${encodeURIComponent(genre)}/page/${page}`
      : `${BASE}/diziler/page/${page}`;
    const html = await fetchWithCache(url, { headers: { Referer: BASE } }, 1800);
    const $ = cheerio.load(html);
    const results = [];

    $('.movie-wrap, .dizi-wrap, article.post, .series-item').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2, .movie-title, .title').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      const poster = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || '';
      const year = $el.text().match(/\b(19|20)\d{2}\b/)?.[0];

      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
          poster,
          year: year ? parseInt(year) : null,
          source: 'dizigom',
          type: 'series'
        });
      }
    });

    return results;
  } catch (e) {
    console.error('[dizigom] list error:', e.message);
    return [];
  }
}

async function searchSeries(query) {
  try {
    const url = `${BASE}/?s=${encodeURIComponent(query)}`;
    const html = await fetchWithCache(url, { headers: { Referer: BASE } }, 1800);
    const $ = cheerio.load(html);
    const results = [];

    $('.movie-wrap, article.post').each((i, el) => {
      const $el = $(el);
      const title = $el.find('h2, .title').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      const poster = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || '';
      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
          poster,
          source: 'dizigom',
          type: 'series'
        });
      }
    });

    return results;
  } catch (e) {
    console.error('[dizigom] search error:', e.message);
    return [];
  }
}

async function getEpisodes(seriesUrl) {
  try {
    const html = await fetchWithCache(seriesUrl, { headers: { Referer: BASE } }, 3600);
    const $ = cheerio.load(html);
    const episodes = [];

    $('.episodes-list a, .episode-item a, .bolum-list a').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const href = $el.attr('href') || '';
      const match = text.match(/(\d+)\.\s*[Ss]ezon\s*(\d+)\.\s*[Bb]ol[üu]m|[Ss](\d+)\s*[Ee](\d+)/);
      if (href) {
        episodes.push({
          title: text,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
          season: parseInt(match?.[1] || match?.[3] || '1'),
          episode: parseInt(match?.[2] || match?.[4] || i + 1)
        });
      }
    });

    return episodes;
  } catch (e) {
    console.error('[dizigom] episodes error:', e.message);
    return [];
  }
}

async function getStreams(episodeUrl) {
  try {
    const html = await fetchWithCache(episodeUrl, { headers: { Referer: BASE } }, 1800);
    const $ = cheerio.load(html);
    const streams = [];

    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && src.includes('http')) {
        streams.push({
          embedUrl: src.startsWith('//') ? `https:${src}` : src,
          quality: 'HD'
        });
      }
    });

    return streams;
  } catch (e) {
    console.error('[dizigom] stream error:', e.message);
    return [];
  }
}

module.exports = { getSeriesList, searchSeries, getEpisodes, getStreams };
