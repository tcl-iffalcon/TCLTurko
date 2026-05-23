const { fetchWithCache } = require('./http');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY || '439c478a97b9c50c43b05706ebf69467';

// Türkçe başlıklardaki yaygın ek/kelime dönüşümleri
// "Tom ve Jerry: Oz'a Yolculuk" → "Tom and Jerry: Back to Oz" gibi eşleşme için
const TR_TO_EN_MAP = {
  ' ve ': ' and ',
  'yolculuk': 'journey',
  'macera': 'adventure',
  'kaçış': 'escape',
  'savaş': 'war',
  'intikam': 'revenge',
  'karanlık': 'dark',
  'gizem': 'mystery',
  'korku': 'fear',
  'aşk': 'love',
  'ölüm': 'death',
  'hayalet': 'ghost',
  'kahraman': 'hero',
  'kral': 'king',
  'prens': 'prince',
  'prenses': 'princess',
  'cadı': 'witch',
  'ejderha': 'dragon',
  'köpek': 'dog',
  'kedi': 'cat',
  'kardan adam': 'snowman',
};

function normalizeTurkish(title) {
  let t = title.toLowerCase();
  for (const [tr, en] of Object.entries(TR_TO_EN_MAP)) {
    t = t.replace(new RegExp(tr, 'gi'), en);
  }
  return t;
}

// Başlıktan yıl/kalite bilgisi temizle: "Film Adı 2024 1080p" → "Film Adı"
function cleanTitle(title) {
  return title
    .replace(/\b(19|20)\d{2}\b/g, '')           // yıl
    .replace(/\b(1080p|720p|4k|hdr|bluray|webrip|dvdrip|cam|ts)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Bir TMDB sonucunun poster'ı var mı kontrol et
function hasPoster(result) {
  return result && result.poster_path;
}

async function searchTMDB(title, type = 'movie', year = null) {
  try {
    const mediaType = type === 'series' ? 'tv' : 'movie';
    const cleaned = cleanTitle(title);

    const trySearch = async (query, lang) => {
      let url = `${TMDB_BASE}/search/${mediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=${lang}`;
      if (year) url += `&year=${year}`;
      const data = await fetchWithCache(url, {}, 86400);
      if (data.results && data.results.length > 0) {
        // Poster'ı olan ilk sonucu tercih et
        const withPoster = data.results.find(r => r.poster_path);
        return withPoster || data.results[0];
      }
      return null;
    };

    // 1. Türkçe arama (orijinal başlık)
    let result = await trySearch(cleaned, 'tr-TR');
    if (hasPoster(result)) return result;

    // 2. İngilizce arama (orijinal başlık)
    result = await trySearch(cleaned, 'en-US');
    if (hasPoster(result)) return result;

    // 3. Türkçe başlığı normalize et ve tekrar dene
    if (cleaned !== title) {
      const normalized = normalizeTurkish(cleaned);
      result = await trySearch(normalized, 'en-US');
      if (hasPoster(result)) return result;
    }

    // 4. Seri başlıksa (": ..." kısmını at) sadece ana adla ara
    if (cleaned.includes(':')) {
      const mainTitle = cleaned.split(':')[0].trim();
      result = await trySearch(mainTitle, 'tr-TR') || await trySearch(mainTitle, 'en-US');
      if (hasPoster(result)) return result;
    }

    // 5. Poster yoksa da bir şey bulduk, döndür (poster boş kalacak ama isim/yıl gelir)
    return result || null;
  } catch (e) {
    return null;
  }
}

async function getTMDBById(tmdbId, type = 'movie') {
  try {
    const mediaType = type === 'series' ? 'tv' : 'movie';
    const url = `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&language=tr-TR&append_to_response=credits,videos,external_ids`;
    return await fetchWithCache(url, {}, 86400);
  } catch (e) {
    return null;
  }
}

async function getTMDBByIMDB(imdbId) {
  try {
    const url = `${TMDB_BASE}/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id&language=tr-TR`;
    const data = await fetchWithCache(url, {}, 86400);
    if (data.movie_results && data.movie_results.length > 0) return { ...data.movie_results[0], media_type: 'movie' };
    if (data.tv_results && data.tv_results.length > 0) return { ...data.tv_results[0], media_type: 'tv' };
    return null;
  } catch (e) {
    return null;
  }
}

function buildMeta(tmdbData, type, id) {
  if (!tmdbData) return null;
  const title = tmdbData.title || tmdbData.name || '';
  const poster = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null;
  const background = tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : null;
  const year = (tmdbData.release_date || tmdbData.first_air_date || '').slice(0, 4);
  const genres = (tmdbData.genres || []).map(g => g.name);
  const cast = tmdbData.credits?.cast?.slice(0, 10).map(a => a.name) || [];
  const director = tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name;
  const imdbId = tmdbData.external_ids?.imdb_id || (id.startsWith('tt') ? id : null);
  const trailer = tmdbData.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  return {
    id: imdbId || id,
    type,
    name: title,
    poster,
    background,
    description: tmdbData.overview || '',
    year: year ? parseInt(year) : undefined,
    genres,
    cast,
    director,
    runtime: tmdbData.runtime ? `${tmdbData.runtime} dk` : undefined,
    language: tmdbData.original_language,
    country: (tmdbData.production_countries || []).map(c => c.iso_3166_1).join(', '),
    imdbRating: tmdbData.vote_average ? tmdbData.vote_average.toFixed(1) : undefined,
    trailers: trailer ? [{ source: trailer.key, type: 'Trailer' }] : [],
    links: imdbId ? [{ name: 'IMDb', category: 'imdb', url: `https://www.imdb.com/title/${imdbId}` }] : [],
    behaviorHints: { defaultVideoId: imdbId || id }
  };
}

module.exports = { searchTMDB, getTMDBById, getTMDBByIMDB, buildMeta, cleanTitle };
