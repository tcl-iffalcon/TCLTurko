const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

const httpClient = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  }
});

async function fetchWithCache(url, options = {}, ttl = 3600) {
  const key = `http:${url}:${JSON.stringify(options)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await httpClient.get(url, options);
      cache.set(key, res.data, ttl);
      return res.data;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function postWithCache(url, data, options = {}, ttl = 1800) {
  const key = `post:${url}:${JSON.stringify(data)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await httpClient.post(url, data, options);
  cache.set(key, res.data, ttl);
  return res.data;
}

function getCache() { return cache; }

module.exports = { fetchWithCache, postWithCache, getCache, httpClient };
