const { fetchWithCache } = require('./http');

const TMDB_BASE = 'https://api.themoviedb.org/3';
// Ücretsiz public key - production'da kendi keyini kullan
const TMDB_KEY = process.env.TMDB_API_KEY || '439c478a97b9c50c43b05706ebf69467';

async function searchTMDB(title, type = 'movie', year = null) {
  try {
    const mediaType = type === 'series' ? 'tv' : 'movie';
    let url = `${TMDB_BASE}/search/${mediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=tr-TR`;
    if (year) url += `&year=${year}`;
    const data = await fetchWithCache(url, {}, 86400);
    if (data.results && data.results.length > 0) return data.results[0];
    // Fallback: İngilizce ara
    const urlEn = `${TMDB_BASE}/search/${mediaType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=en-US`;
    const dataEn = await fetchWithCache(urlEn, {}, 86400);
    return dataEn.results && dataEn.results.length > 0 ? dataEn.results[0] : null;
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
  const isTV = type === 'series';
  const title = tmdbData.title || tmdbData.name || '';
  const originalTitle = tmdbData.original_title || tmdbData.original_name || '';
  const poster = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null;
  const background = tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : null;
  const year = (tmdbData.release_date || tmdbData.first_air_date || '').slice(0, 4);
  const genres = (tmdbData.genres || []).map(g => g.name);
  const cast = tmdbData.credits?.cast?.slice(0, 10).map(a => a.name) || [];
  const director = tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name;
  const imdbId = tmdbData.external_ids?.imdb_id || id;
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

module.exports = { searchTMDB, getTMDBById, getTMDBByIMDB, buildMeta };
