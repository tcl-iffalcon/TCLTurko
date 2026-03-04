app.get("/configure", (req, res) => {
  const manifestUrl = `${getBaseUrl(req)}/manifest.json`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TCLTurko</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
  <style>
    :root {
      --red:        #cc0000;
      --red-deep:   #8b0000;
      --red-bright: #e8002a;
      --red-dim:    rgba(204,0,0,0.25);
      --white:      #ffffff;
      --white-dim:  rgba(255,255,255,0.08);
      --white-soft: rgba(255,255,255,0.65);
      --bg:         #0d0000;
      --border:     rgba(255,255,255,0.1);
      --text:       #f5f0f0;
      --muted:      rgba(255,255,255,0.4);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: var(--bg); font-family: 'Montserrat', sans-serif; color: var(--text); overflow: hidden; }

    /* ── Background ── */
    .bg { position: fixed; inset: 0; z-index: 0; }
    .bg-photo {
      position: absolute; inset: 0;
      background: url('/bayrak.jpg') center/cover no-repeat;
      opacity: 0.85;
      transform: scale(1.05);
    }
    .bg-overlay {
      position: absolute; inset: 0;
      background:
        linear-gradient(to right,
          rgba(10,0,0,0.97) 0%,
          rgba(10,0,0,0.85) 30%,
          rgba(10,0,0,0.4)  60%,
          rgba(10,0,0,0.15) 100%
        );
    }
    .bg-red-glow {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 50% 80% at 15% 50%, rgba(180,0,0,0.18) 0%, transparent 70%);
    }

    /* ── Layout ── */
    .stage {
      position: relative; z-index: 10;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
      padding: 2.5rem 5rem;
      max-width: 1300px;
      margin: 0 auto;
    }

    /* ── Panel ── */
    .panel {
      width: 100%;
      max-width: 420px;
      opacity: 0;
      transform: translateX(-20px);
      animation: slideIn 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;
    }

    /* ── Brand ── */
    .eyebrow {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: var(--red-bright);
      margin-bottom: 1.2rem;
    }
    .eyebrow-line {
      width: 24px; height: 1px;
      background: var(--red-bright);
      opacity: 0.7;
    }

    .logo {
      font-family: 'Montserrat', sans-serif;
      font-weight: 900;
      font-size: 4.8rem;
      line-height: 0.9;
      letter-spacing: -0.03em;
      color: var(--white);
      margin-bottom: 0.2em;
      text-shadow: 0 2px 20px rgba(0,0,0,0.9);
    }
    .logo span {
      color: var(--red-bright);
      text-shadow: 0 0 30px rgba(232,0,42,0.5), 0 2px 20px rgba(0,0,0,0.9);
    }

    .crescent {
      font-size: 1.4rem;
      margin-left: 0.15em;
      vertical-align: middle;
      filter: drop-shadow(0 0 8px rgba(232,0,42,0.6));
    }

    .rule {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin: 1.4rem 0 1.2rem;
    }
    .rule-line {
      height: 1px;
      background: linear-gradient(to right, var(--red), transparent);
      flex: 1;
      max-width: 40px;
      opacity: 0.7;
    }
    .rule-dot {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: var(--red-bright);
      opacity: 0.8;
    }

    .tagline {
      font-size: 0.82rem;
      font-weight: 400;
      line-height: 1.85;
      color: rgba(255,255,255,0.8);
      margin-bottom: 2rem;
      text-shadow: 0 1px 8px rgba(0,0,0,0.9);
    }
    .tagline strong { color: #fff; font-weight: 600; }

    /* ── Card ── */
    .card {
      background: rgba(10,0,0,0.55);
      border: 1px solid rgba(204,0,0,0.2);
      border-radius: 18px;
      padding: 1.6rem;
      backdrop-filter: blur(24px) saturate(1.3);
      -webkit-backdrop-filter: blur(24px) saturate(1.3);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.04) inset,
        0 24px 80px rgba(0,0,0,0.7),
        0 0 40px rgba(180,0,0,0.08);
    }

    /* ── Buttons ── */
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.82rem 1.2rem;
      border-radius: 10px;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.84rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
      margin-bottom: 0.55rem;
      position: relative;
      overflow: hidden;
    }

    .btn-stremio {
      background: linear-gradient(135deg, #8458f5 0%, #5b2de8 100%);
      color: #fff;
      box-shadow: 0 4px 20px rgba(132,88,245,0.3);
    }
    .btn-stremio:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(132,88,245,0.5); }

    .btn-nuvio {
      background: linear-gradient(135deg, #e8002a 0%, #8b0000 100%);
      color: #fff;
      box-shadow: 0 4px 20px rgba(204,0,0,0.3);
    }
    .btn-nuvio:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(204,0,0,0.5); }

    .btn-ghost {
      background: rgba(255,255,255,0.04);
      color: var(--muted);
      border: 1px solid rgba(204,0,0,0.2);
      margin-bottom: 0;
    }
    .btn-ghost:hover { color: var(--text); border-color: rgba(204,0,0,0.4); transform: translateY(-1px); }

    /* ── Divider ── */
    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.1rem 0;
    }
    .divider-line { flex: 1; height: 1px; background: rgba(204,0,0,0.2); }
    .divider-text { font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.2); }

    /* ── URL box ── */
    .url-label {
      font-size: 0.55rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.2);
      margin-bottom: 0.4rem;
    }
    .url-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(204,0,0,0.15);
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s;
    }
    .url-row:hover { border-color: rgba(204,0,0,0.4); background: rgba(0,0,0,0.5); }
    .url-text {
      flex: 1;
      font-size: 0.6rem;
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: rgba(255,255,255,0.22);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-icon { width: 13px; height: 13px; fill: rgba(255,255,255,0.18); flex-shrink: 0; transition: fill 0.15s; }
    .url-row:hover .copy-icon { fill: var(--red-bright); }
    .copied-msg {
      font-size: 0.6rem; color: var(--red-bright);
      text-align: right; margin-top: 0.3rem;
      height: 0.9rem; opacity: 0; transition: opacity 0.25s;
    }
    .copied-msg.show { opacity: 1; }

    /* ── Badge strip ── */
    .badges {
      display: flex;
      gap: 0.4rem;
      margin-top: 1.3rem;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.22rem 0.6rem;
      border-radius: 20px;
      border: 1px solid rgba(204,0,0,0.3);
      color: rgba(232,0,42,0.7);
      background: rgba(204,0,0,0.08);
    }
    .badge.white {
      border-color: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.03);
    }

    /* ── Animations ── */
    @keyframes slideIn { to { opacity: 1; transform: translateX(0); } }

    /* ── Mobile ── */
    @media (max-width: 680px) {
      .stage { justify-content: center; padding: 2rem 1.5rem; }
      .logo { font-size: 3.6rem; }
    }
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
        <strong>SineWix</strong> üzerinden içerikler çeker, Türkçe dublaj içeriklere <strong>Türk bayrağı</strong> ekler,<br>
        TMDB'den aldığı posterleri <strong>AI ile yapılandırır.</strong><br>
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

        <div class="divider">
          <div class="divider-line"></div>
          <span class="divider-text">veya</span>
          <div class="divider-line"></div>
        </div>

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

        <div class="badges">
          <div class="badge">🇹🇷 Türkçe Dublaj</div>
          <div class="badge">🎨 AI Poster</div>
          <div class="badge white">Sinewix</div>
          <div class="badge white">TMDB</div>
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
