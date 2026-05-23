# 🎬 Nuvio - Stremio Addon

Sinewix tarzı Türkçe Stremio eklentisi. Birden fazla kaynaktan film ve dizi akışı sağlar.

## Özellikler

- 🎬 Türkçe film kataloğu (fullhdfilmizlesene.life)
- 📺 Türkçe dizi kataloğu (dizigom)
- 📡 M3U playlist entegrasyonu (19.000+ film)
- 🔍 Arama desteği (TR + EN)
- 🏷️ Tür filtreleme
- 🖼️ TMDB metadata (poster, açıklama, puan)
- 🌍 Çift dil arayüzü (TR/EN)
- ⚡ Akıllı önbellekleme

## Kurulum

```bash
npm install
npm start
```

Ardından Stremio'ya şu adresi ekle:
```
http://localhost:7000/manifest.json
```

## Yapılandırma

`.env` dosyası oluştur:
```env
TMDB_API_KEY=kendi_tmdb_keyini_buraya_yaz
PORT=7000
```

## Deployment (Ücretsiz)

### Railway
```bash
railway login
railway init
railway up
```

### Render
- render.com'da "New Web Service" oluştur
- Bu repo'yu bağla
- Start command: `npm start`

### Vercel (Serverless)
- `vercel.json` ile deploy edilebilir

## Kaynak Yapısı

```
nuvio-addon/
├── index.js              # Ana giriş noktası
├── manifest.js           # Stremio manifest
├── handlers/
│   ├── catalog.js        # Katalog handler
│   ├── meta.js           # Metadata handler
│   └── stream.js         # Stream handler
├── scrapers/
│   ├── fullhd.js         # fullhdfilmizlesene scraper
│   ├── dizigom.js        # dizigom.com scraper
│   └── m3u.js            # M3U playlist parser
└── utils/
    ├── http.js           # HTTP client + cache
    └── tmdb.js           # TMDB API helper
```

## Notlar

- Scraper tabanlı çalıştığından kaynak siteler değişirse güncelleme gerekebilir
- TMDB API key olmadan temel işlevler çalışır ancak metadata sınırlı olur
- Ücretsiz TMDB key: https://www.themoviedb.org/settings/api
