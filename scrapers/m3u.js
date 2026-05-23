const { fetchWithCache } = require('../utils/http');
const NodeCache = require('node-cache');

const M3U_URL = 'https://cdn.jsdelivr.net/gh/umitm0d/Liveinlive@main/Filmler.m3u';
const listCache = new NodeCache({ stdTTL: 43200 }); // 12 saat

function parseM3U(content) {
  const lines = content.split('\n');
  const items = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);
      current = {
        logo: logoMatch?.[1] || '',
        group: groupMatch?.[1] || 'Genel',
        title: nameMatch?.[1]?.trim() || '',
        url: null,
        referrer: null,
        userAgent: null
      };
    } else if (line.startsWith('#EXTVLCOPT:http-referrer=') && current) {
      current.referrer = line.split('=').slice(1).join('=');
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=') && current) {
      current.userAgent = line.split('=').slice(1).join('=');
    } else if (line && !line.startsWith('#') && current) {
      current.url = line;
      if (current.title && current.url) items.push({ ...current });
      current = null;
    }
  }

  return items;
}

async function loadM3UList() {
  const cached = listCache.get('m3u_list');
  if (cached) return cached;

  try {
    const content = await fetchWithCache(M3U_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      responseType: 'text'
    }, 43200);
    const items = parseM3U(typeof content === 'string' ? content : JSON.stringify(content));
    listCache.set('m3u_list', items);
    console.log(`[M3U] ${items.length} öğe yüklendi`);
    return items;
  } catch (e) {
    console.error('[M3U] yükleme hatası:', e.message);
    return [];
  }
}

async function searchM3U(query) {
  const items = await loadM3UList();
  const q = query.toLowerCase().trim();
  return items.filter(item => item.title.toLowerCase().includes(q));
}

async function getM3UByTitle(title) {
  const items = await loadM3UList();
  const t = title.toLowerCase().trim();
  return items.filter(item => {
    const itemTitle = item.title.toLowerCase().trim();
    return itemTitle === t || itemTitle.includes(t) || t.includes(itemTitle);
  });
}

async function getM3UStreams(title) {
  const matches = await getM3UByTitle(title);
  return matches.map((item, idx) => ({
    url: item.url,
    title: `📡 Nuvio M3U - Kaynak ${idx + 1}`,
    behaviorHints: {
      notWebReady: false,
      headers: {
        ...(item.referrer ? { Referer: item.referrer } : {}),
        ...(item.userAgent ? { 'User-Agent': item.userAgent } : {})
      }
    }
  }));
}

// Paginated list
async function getM3UPage(skip = 0, limit = 20) {
  const items = await loadM3UList();
  // Tekrarsız liste
  const seen = new Set();
  const unique = items.filter(item => {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.slice(skip, skip + limit);
}

module.exports = { loadM3UList, searchM3U, getM3UByTitle, getM3UStreams, getM3UPage };
