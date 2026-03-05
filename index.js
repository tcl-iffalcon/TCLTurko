const express      = require("express");
const cors         = require("cors");
const fetch        = require("node-fetch");
const path         = require("path");

global.fetch = fetch;

const { fetchCatalog } = require("./catalog");
const { fetchMeta }    = require("./meta");
const { fetchStreams }  = require("./stream");
const baseManifest     = require("./manifest.json");
const {
  triggerPoster,
  posterUrl,
  posterKey,
  existsInB2,
  getQueueStatus,
  AI_PENDING,
} = require("./poster");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/bayrak.jpg", (req, res) =>
  res.sendFile(path.join(__dirname, "bayrak.jpg"))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${req.get("host")}`;
}

// ─── Configure ────────────────────────────────────────────────────────────────

app.get("/configure", (req, res) => {
  const manifestUrl = `${getBaseUrl(req)}/manifest.json`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCLTurko</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --red: #cc0000; --red-deep: #8b0000; --red-bright: #e8002a;
      --bg: #0d0000; --surface: rgba(10,0,0,0.55);
      --border: rgba(204,0,0,0.2); --text: #f5f0f0;
      --muted: rgba(255,255,255,0.4);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: var(--bg); font-family: 'Montserrat', sans-serif; color: var(--text); overflow: hidden; }
    .bg { position: fixed; inset: 0; z-index: 0; }
    .bg-photo { position: absolute; inset: 0; background: url('/bayrak.jpg') center/cover no-repeat; opacity: 0.85; transform: scale(1.05); }
    .bg-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(10,0,0,0.97) 0%, rgba(10,0,0,0.85) 30%, rgba(10,0,0,0.4) 60%, rgba(10,0,0,0.15) 100%); }
    .bg-red-glow { position: absolute; inset: 0; background: radial-gradient(ellipse 50% 80% at 15% 50%, rgba(180,0,0,0.18) 0%, transparent 70%); }
    .stage { position: relative; z-index: 10; display: flex; align-items: center; justify-content: flex-start; min-height: 100vh; padding: 2.5rem 5rem; max-width: 1300px; margin: 0 auto; }
    .panel { width: 100%; max-width: 420px; opacity: 0; transform: translateX(-20px); animation: slideIn 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s forwards; }
    .eyebrow { display: flex; align-items: center; gap: 0.5rem; font-size: 0.6rem; font-weight: 600; letter-spacing: 0.38em; text-transform: uppercase; color: var(--red-bright); margin-bottom: 1.2rem; }
    .eyebrow-line { width: 24px; height: 1px; background: var(--red-bright); opacity: 0.7; }
    .logo { font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 4.8rem; line-height: 0.9; letter-spacing: -0.03em; color: #fff; margin-bottom: 0.2em; text-shadow: 0 2px 20px rgba(0,0,0,0.9); }
    .logo span { color: var(--red-bright); text-shadow: 0 0 30px rgba(232,0,42,0.5), 0 2px 20px rgba(0,0,0,0.9); }
    .crescent { font-size: 1.4rem; margin-left: 0.15em; vertical-align: middle; filter: drop-shadow(0 0 8px rgba(232,0,42,0.6)); }
    .rule { display: flex; align-items: center; gap: 0.6rem; margin: 1.4rem 0 1.2rem; }
    .rule-line { height: 1px; background: linear-gradient(to right, var(--red), transparent); flex: 1; max-width: 40px; opacity: 0.7; }
    .rule-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--red-bright); opacity: 0.8; }
    .tagline { font-size: 0.82rem; font-weight: 400; line-height: 1.85; color: rgba(255,255,255,0.8); margin-bottom: 2rem; text-shadow: 0 1px 8px rgba(0,0,0,0.9); }
    .tagline strong { color: #fff; font-weight: 600; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 1.6rem; backdrop-filter: blur(24px) saturate(1.3); box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 80px rgba(0,0,0,0.7); }
    .btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.82rem 1.2rem; border-radius: 10px; font-family: 'Montserrat', sans-serif; font-size: 0.84rem; font-weight: 600; cursor: pointer; text-decoration: none; border: none; transition: all 0.2s; margin-bottom: 0.55rem; }
    .btn-stremio { background: linear-gradient(135deg, #8458f5, #5b2de8); color: #fff; box-shadow: 0 4px 20px rgba(132,88,245,0.3); }
    .btn-stremio:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(132,88,245,0.5); }
    .btn-nuvio { background: linear-gradient(135deg, #e8002a, #8b0000); color: #fff; box-shadow: 0 4px 20px rgba(204,0,0,0.3); }
    .btn-nuvio:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(204,0,0,0.5); }
    .btn-ghost { background: rgba(255,255,255,0.04); color: var(--muted); border: 1px solid rgba(204,0,0,0.2); margin-bottom: 0; }
    .btn-ghost:hover { color: var(--text); border-color: rgba(204,0,0,0.4); transform: translateY(-1px); }
    .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.1rem 0; }
    .divider-line { flex: 1; height: 1px; background: rgba(204,0,0,0.2); }
    .divider-text { font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.2); }
    .url-label { font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.2); margin-bottom: 0.4rem; }
    .url-row { display: flex; align-items: center; gap: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(204,0,0,0.15); border-radius: 8px; padding: 0.6rem 0.85rem; cursor: pointer; transition: border-color 0.18s; }
    .url-row:hover { border-color: rgba(204,0,0,0.4); }
    .url-text { flex: 1; font-size: 0.6rem; font-family: monospace; color: rgba(255,255,255,0.22); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .copy-icon { width: 13px; height: 13px; fill: rgba(255,255,255,0.18); flex-shrink: 0; transition: fill 0.15s; }
    .url-row:hover .copy-icon { fill: var(--red-bright); }
    .copied-msg { font-size: 0.6rem; color: var(--red-bright); text-align: right; margin-top: 0.3rem; height: 0.9rem; opacity: 0; transition: opacity 0.25s; }
    .copied-msg.show { opacity: 1; }
    .badges { display: flex; gap: 0.4rem; margin-top: 1.3rem; flex-wrap: wrap; }
    .badge { font-size: 0.55rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.22rem 0.6rem; border-radius: 20px; border: 1px solid rgba(204,0,0,0.3); color: rgba(232,0,42,0.7); background: rgba(204,0,0,0.08); }
    .badge.white { border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.03); }
    @keyframes slideIn { to { opacity: 1; transform: translateX(0); } }
    @media (max-width: 680px) { .stage { justify-content: center; padding: 2rem 1.5rem; } .logo { font-size: 3.6rem; } }
  </style>
</head>
<body>
  <div class="bg">
    <div class="bg-photo"></div>
    <div class="bg-overlay"></div>
    <div class="bg-red-glow"></div>
  </div>
  <div class="stage">
    <div class="panel">
      <div class="eyebrow">
        <div class="eyebrow-line"></div>
        Stremio &amp; Nuvio Addon
      </div>
      <h1 class="logo">TCL<span>Turko</span><span class="crescent">☽</span></h1>
      <div class="rule">
        <div class="rule-line"></div>
        <div class="rule-dot"></div>
        <div class="rule-dot" style="opacity:.3"></div>
      </div>
      <p class="tagline">
        Türkçe dublaj içeriklere <strong>🇹🇷 bayrak</strong> ekler,<br>
        posterleri <strong>yapay zeka</strong> ile oluşturur.<br>
        <strong>TCLTVTURK</strong> ekibi tarafından ♥️ ile yapıldı.
      </p>
      <div class="card">
        <a class="btn btn-stremio" id="stremioBtn" href="#">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
          Stremio'ya Yükle
        </a>
        <a class="btn btn-nuvio" id="nuvioBtn" href="#">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
          Nuvio'ya Yükle
        </a>
        <div class="divider"><div class="divider-line"></div><span class="divider-text">veya</span><div class="divider-line"></div></div>
        <div class="url-label">Manifest URL</div>
        <div class="url-row" id="urlRow">
          <svg class="copy-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          <span class="url-text" id="urlText">${manifestUrl}</span>
        </div>
        <div class="copied-msg" id="copiedMsg">Kopyalandı ✓</div>
        <div style="margin-top:1rem">
          <a class="btn btn-ghost" href="/poster-status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-4l-3-3.75L6 15h12l-3.75-5-2.25 3z"/></svg>
            Poster Kuyruğu
          </a>
        </div>
        
      </div>
    </div>
  </div>
  <script>
    const manifest = '${manifestUrl}';
    document.getElementById('urlText').textContent = manifest;
    document.getElementById('stremioBtn').href = manifest.replace(/^https?:\\/\\//, 'stremio://');
    document.getElementById('nuvioBtn').addEventListener('click', e => {
      e.preventDefault();
      navigator.clipboard.writeText(manifest).then(() => {
        const btn = document.getElementById('nuvioBtn');
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Kopyalandı!';
        setTimeout(() => { btn.innerHTML = orig; }, 2200);
      });
    });
    document.getElementById('urlRow').addEventListener('click', () => {
      navigator.clipboard.writeText(manifest).then(() => {
        const el = document.getElementById('copiedMsg');
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2200);
      });
    });
  </script>
</body>
</html>`);
});

// ─── Manifest ─────────────────────────────────────────────────────────────────

app.get("/manifest.json",           (req, res) => res.json(baseManifest));
app.get("/:config/manifest.json",   (req, res) => res.json(baseManifest));

// ─── AI Poster ────────────────────────────────────────────────────────────────

app.get("/ai-poster", async (req, res) => {
  const { title, year, type, genres, overview, fallback } = req.query;
  if (!title) return fallback ? res.redirect(fallback) : res.status(400).send("Missing title");

  const key    = posterKey(title, year);
  const cldUrl = posterUrl(title, year);

  try {
    const exists = await existsInB2(title, year);
    if (exists) { console.log(`[Poster] Cache hit: ${key}`); return res.redirect(cldUrl); }
  } catch (err) {
    console.error(`[Poster] Cache check error: ${err.message}`);
  }

  if (AI_PENDING.has(key)) {
    try { await AI_PENDING.get(key); return res.redirect(cldUrl); }
    catch { return fallback ? res.redirect(fallback) : res.status(500).send("Generation failed"); }
  }

  triggerPoster(title, year, type, genres, overview, fallback || null);
  try {
    const pending = AI_PENDING.get(key);
    if (pending) await pending;
    return res.redirect(cldUrl);
  } catch {
    return fallback ? res.redirect(fallback) : res.status(500).send("Generation failed");
  }
});

// ─── Poster Queue Status ──────────────────────────────────────────────────────

app.get("/poster-status", (req, res) => {
  const status  = getQueueStatus();
  const pending = [...AI_PENDING.keys()];
  res.send(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="UTF-8"><title>Poster Kuyruğu</title>
<meta http-equiv="refresh" content="5">
<style>body{background:#0a0a0f;color:#e8e0d5;font-family:monospace;padding:2rem}h2{color:#c9a84c;margin-bottom:1rem}.stat{margin:.4rem 0}.key{color:#7a6e60}ul{margin-top:1rem;padding-left:1.2rem}li{font-size:.8rem;color:#a09080;margin:.2rem 0}a{color:#c9a84c}</style>
</head><body>
<h2>🎨 AI Poster Kuyruğu</h2>
${status.quotaExhausted ? '<div style="background:#3a1a1a;border:1px solid #c94c4c;border-radius:6px;padding:.75rem 1rem;margin-bottom:1rem;color:#e07070;">⚠️ Quota tükendi. TMDB poster kullanılıyor.</div>' : ''}
<div class="stat"><span class="key">Aktif:   </span> ${status.active} / ${status.max}</div>
<div class="stat"><span class="key">Kuyruk:  </span> ${status.queued}</div>
<div class="stat"><span class="key">Bekleyen:</span> ${status.pending}</div>
${pending.length > 0 ? `<ul>${pending.map(k => `<li>${k}</li>`).join("")}</ul>` : "<p style='margin-top:1rem;color:#7a6e60'>Kuyruk boş.</p>"}
<p style="margin-top:2rem;font-size:.75rem;color:#7a6e60">5 saniyede bir yenilenir. <a href="/configure">← Geri</a></p>
</body></html>`);
});

// ─── Catalog ──────────────────────────────────────────────────────────────────

async function handleCatalog(req, res) {
  const { type, id } = req.params;
  const baseUrl = getBaseUrl(req);
  const skip    = parseInt(
    req.query.skip ||
    (req.params.extra || "").replace("skip=", "") ||
    "0"
  );
  console.log(`[Catalog] type=${type} id=${id} skip=${skip}`);
  try {
    const metas = await fetchCatalog(id, type, skip, baseUrl);
    res.json({ metas });
  } catch (err) {
    console.error(`[Catalog] ${err.message}`);
    res.json({ metas: [] });
  }
}

app.get("/catalog/:type/:id/:extra?.json",         handleCatalog);
app.get("/:config/catalog/:type/:id/:extra?.json",  handleCatalog);

// ─── Meta ─────────────────────────────────────────────────────────────────────

async function handleMeta(req, res) {
  const { type, id } = req.params;
  const baseUrl = getBaseUrl(req);
  console.log(`[Meta] type=${type} id=${id}`);
  try {
    const meta = await fetchMeta(id, type, baseUrl);
    res.json({ meta: meta || null });
  } catch (err) {
    console.error(`[Meta] ${err.message}`);
    res.json({ meta: null });
  }
}

app.get("/meta/:type/:id.json",         handleMeta);
app.get("/:config/meta/:type/:id.json",  handleMeta);

// ─── Stream ───────────────────────────────────────────────────────────────────

async function handleStream(req, res) {
  const { type, id } = req.params;
  console.log(`[Stream] type=${type} id=${id}`);
  try {
    const streams = await fetchStreams(id, type);
    res.json({ streams: streams || [] });
  } catch (err) {
    console.error(`[Stream] ${err.message}`);
    res.json({ streams: [] });
  }
}

app.get("/stream/:type/:id.json",         handleStream);
app.get("/:config/stream/:type/:id.json",  handleStream);

// ─── Root ─────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.redirect("/configure"));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎬 TCLTurko çalışıyor: http://localhost:${PORT}`);
  console.log(`📺 Configure:      http://localhost:${PORT}/configure`);
  console.log(`📋 Manifest:       http://localhost:${PORT}/manifest.json`);
  console.log(`🎨 Poster kuyruğu: http://localhost:${PORT}/poster-status\n`);

  const missing = ["REPLICATE_TOKEN", "CLD_CLOUD", "CLD_KEY", "CLD_SECRET"].filter(k => !process.env[k]);
  if (missing.length) {
    console.warn(`⚠️  Eksik env vars: ${missing.join(", ")}`);
    console.warn("   AI poster üretimi devre dışı.\n");
  }
});
