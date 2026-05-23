const MANIFEST = {
  id: 'community.nuvio',
  version: '1.0.0',
  name: 'Nuvio',
  description: 'Türkçe film ve dizi akış eklentisi | Turkish movie & series streaming addon. Powered by multiple sources.',
  logo: 'https://i.imgur.com/placeholder.png',
  background: 'https://i.imgur.com/placeholder-bg.png',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'nuvio:'],
  catalogs: [
    {
      id: 'nuvio-movies-tr',
      type: 'movie',
      name: '🎬 Nuvio Filmler',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'genre', isRequired: false, options: ['Aksiyon', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Romantik', 'Animasyon', 'Belgesel', 'Suç', 'Gerilim'] },
        { name: 'skip', isRequired: false }
      ]
    },
    {
      id: 'nuvio-series-tr',
      type: 'series',
      name: '📺 Nuvio Diziler',
      extra: [
        { name: 'search', isRequired: false },
        { name: 'genre', isRequired: false, options: ['Aksiyon', 'Komedi', 'Dram', 'Korku', 'Bilim Kurgu', 'Romantik', 'Animasyon', 'Suç', 'Gerilim'] },
        { name: 'skip', isRequired: false }
      ]
    },
    {
      id: 'nuvio-movies-new',
      type: 'movie',
      name: '🆕 Yeni Filmler',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      id: 'nuvio-movies-popular',
      type: 'movie',
      name: '🔥 Popüler Filmler',
      extra: [{ name: 'skip', isRequired: false }]
    }
  ]
};

module.exports = { MANIFEST };
