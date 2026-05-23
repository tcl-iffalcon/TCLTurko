const cheerio = require('cheerio');
const axios = require('axios');
const { getCache } = require('../utils/http');

// Sitenin farklı domain'leri — 403 alınırsa sıradakine geçilir
const DOMAINS = [
  'https://www.fullhdfilmizlesene.pw',
  'https://www.fullhdfilmizlesene.cx',
  'https://www.fullhdfilmizlesene.life',
  'https://www.fullhdfilmizle.pw',
];

// Tarayıcıya benzer header seti
function getBrowserHeaders(referer) {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    ...(referer ? { Referer: referer } : {}),
  };
}

// Domain'leri sırayla dene; 403/bağlantı hatası → sonraki domain
async function fetchFromDomains(pathFn, ttl = 1800) {
  const cache = getCache();

  for (const base of DOMAINS) {
    const url = pathFn(base);
    const cacheKey = `fullhd:${url}`;

    // Önce cache'e bak
    const cached = cache.get(cacheKey);
    if (cached) return { html: cached, base };

    try {
      const res = await axios.get(url, {
        headers: getBrowserHeaders(base),
        timeout: 12000,
        maxRedirects: 5,
        // Cloudflare challenge sayfasını da al, boş değil mi kontrol et
        validateStatus: (s) => s < 500,
      });

      if (res.status === 403 || res.status === 401) {
        console.warn(`[fullhdfilmizlesene] ${base} → ${res.status}, sonraki domain deneniyor...`);
        continue;
      }

      const html = res.data;

      // Cloudflare "Just a moment" sayfası geldi mi?
      if (typeof html === 'string' && html.includes('Just a moment') && html.includes('cf-browser-verification')) {
        console.warn(`[fullhdfilmizlesene] ${base} → Cloudflare challenge, atlanıyor...`);
        continue;
      }

      cache.set(cacheKey, html, ttl);
      return { html, base };
    } catch (e) {
      console.warn(`[fullhdfilmizlesene] ${base} → hata: ${e.message}`);
    }
  }

  throw new Error('Tüm domain\'ler başarısız oldu');
}

// HTML parse — birden fazla selector seti dene (site tasarımı değişebilir)
function parseMovieItems($, base) {
  const results = [];
  const SELECTORS = [
    { wrap: '.movies-list .ml-item', title: '.mli-info h2', img: 'img', year: '.mli-quality' },
    { wrap: '.film-list .item',       title: '.movie-title',  img: 'img', year: '.year' },
    { wrap: 'article.post',           title: 'h2.entry-title',img: 'img', year: '.movie-year' },
    { wrap: '.content-row article',   title: 'h2',            img: 'img', year: '' },
  ];

  for (const sel of SELECTORS) {
    $(sel.wrap).each((i, el) => {
      const $el = $(el);
      const title = $el.find(sel.title).first().text().trim()
        || $el.find('h2').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';
      const poster =
        $el.find(sel.img).first().attr('data-original') ||
        $el.find(sel.img).first().attr('data-src') ||
        $el.find(sel.img).first().attr('src') || '';
      const yearText = sel.year ? ($el.find(sel.year).first().text() || '') : $el.text();
      const year = yearText.match(/\b(19|20)\d{2}\b/)?.[0];
      const rating = $el.find('.mli-score, .imdb-rating, .rating').first().text().trim();

      if (title && href) {
        results.push({
          title,
          url: href.startsWith('http') ? href : `${base}${href}`,
          poster,
          year: year ? parseInt(year) : null,
          rating: parseFloat(rating) || null,
          source: 'fullhdfilmizlesene',
        });
      }
    });
    if (results.length > 0) break; // İlk çalışan selector yeterli
  }

  return results;
}

async function getMovieList(page = 1, genre = null) {
  try {
    const { html, base } = await fetchFromDomains(
      (b) => genre
        ? `${b}/tur/${encodeURIComponent(genre)}/page/${page}`
        : `${b}/filmler/page/${page}`,
      1800
    );
    const $ = cheerio.load(html);
    return parseMovieItems($, base);
  } catch (e) {
    console.error('[fullhdfilmizlesene] list error:', e.message);
    return [];
  }
}

async function getNewMovies(page = 1) {
  try {
    const { html, base } = await fetchFromDomains(
      (b) => `${b}/page/${page}`,
      900
    );
    const $ = cheerio.load(html);
    return parseMovieItems($, base);
  } catch (e) {
    console.error('[fullhdfilmizlesene] new error:', e.message);
    return [];
  }
}

async function searchMovies(query) {
  try {
    const { html, base } = await fetchFromDomains(
      (b) => `${b}/?s=${encodeURIComponent(query)}`,
      1800
    );
    const $ = cheerio.load(html);
    return parseMovieItems($, base);
  } catch (e) {
    console.error('[fullhdfilmizlesene] search error:', e.message);
    return [];
  }
}

async function getStreams(pageUrl) {
  try {
    // pageUrl zaten tam URL, doğrudan fetch et
    const cache = getCache();
    const cacheKey = `fullhd:${pageUrl}`;
    let html = cache.get(cacheKey);

    if (!html) {
      // pageUrl'den base domain'i çıkar
      const urlObj = new URL(pageUrl);
      const base = `${urlObj.protocol}//${urlObj.host}`;

      const res = await axios.get(pageUrl, {
        headers: getBrowserHeaders(base),
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (s) => s < 500,
      });

      if (res.status === 403) {
        console.error('[fullhdfilmizlesene] stream page 403:', pageUrl);
        return [];
      }

      html = res.data;
      cache.set(cacheKey, html, 1800);
    }

    const $ = cheerio.load(html);
    const streams = [];

    // Bilinen embed player'ları
    const EMBED_PATTERNS = [
      'rapidvid', 'vidmoxy', 'trplayer', 'sobreats',
      'drive.google', 'vidcloud', 'streamtape', 'doodstream',
      'filemoon', 'voe.sx', 'upstream', 'mixdrop',
    ];

    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const cleanSrc = src.startsWith('//') ? `https:${src}` : src;
      if (cleanSrc && EMBED_PATTERNS.some(p => cleanSrc.includes(p))) {
        streams.push({ embedUrl: cleanSrc, quality: 'HD' });
      } else if (cleanSrc && cleanSrc.startsWith('http')) {
        // Bilinmeyen embed — yine de ekle
        streams.push({ embedUrl: cleanSrc, quality: 'HD' });
      }
    });

    // Script içindeki m3u8 / mp4 URL'leri
    $('script').each((i, el) => {
      const txt = $(el).html() || '';

      const m3u8s = txt.match(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g) || [];
      m3u8s.forEach(m => {
        const url = m.slice(1); // baştaki tırnak
        streams.push({ url, quality: 'HD', type: 'hls' });
      });

      const mp4s = txt.match(/["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)/g) || [];
      mp4s.forEach(m => {
        const url = m.slice(1);
        streams.push({ url, quality: 'HD', type: 'mp4' });
      });

      // jwplayer / flowplayer sources
      const fileProp = txt.match(/(?:file|src|source)\s*[:=]\s*["']([^"']+(?:\.m3u8|\.mp4)[^"']*)/g) || [];
      fileProp.forEach(m => {
        const url = m.match(/["']([^"']+(?:\.m3u8|\.mp4)[^"']*)/)?.[1];
        if (url) streams.push({ url, quality: 'HD' });
      });
    });

    // Tekrar eden URL'leri temizle
    const seen = new Set();
    return streams.filter(s => {
      const key = s.url || s.embedUrl;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e) {
    console.error('[fullhdfilmizlesene] stream error:', e.message);
    return [];
  }
}

module.exports = { getMovieList, getNewMovies, searchMovies, getStreams };
