const fetch = require("node-fetch");
const crypto = require("crypto");

// ─── Cloudinary Config ────────────────────────────────────────────────────────
const CLD_CLOUD  = process.env.CLD_CLOUD  || "TCLTURKO";
const CLD_KEY    = process.env.CLD_KEY    || "378592846311688";
const CLD_SECRET = process.env.CLD_SECRET || "yeAi5aYoWfch8N1SlgB1v0Dp5Lc";
const CLD_FOLDER = "posters";
const CLD_BASE   = `https://res.cloudinary.com/${CLD_CLOUD}/image/upload/${CLD_FOLDER}`;

// ─── Replicate Config ─────────────────────────────────────────────────────────
const REPLICATE_TOKEN = process.env.REPLICATE_TOKEN || "";

// ─── Poster versioning ────────────────────────────────────────────────────────
const POSTER_VERSION = process.env.POSTER_VERSION || "v14";

// ─── Concurrency & Queue ──────────────────────────────────────────────────────
const AI_PENDING     = new Map();
let   activeRequests = 0;
const MAX_CONCURRENT = 1;
const requestQueue   = [];

const MIN_REQUEST_INTERVAL_MS = 11000;
let   lastRequestTime         = 0;
let   replicateQuotaExhausted = false;

// ─── Genre map ────────────────────────────────────────────────────────────────
const GENRE_MAP = {
  28: "action", 12: "adventure", 16: "animation", 35: "comedy",
  80: "crime", 99: "documentary", 18: "drama", 10751: "family",
  14: "fantasy", 36: "history", 27: "horror", 10402: "music",
  9648: "mystery", 10749: "romance", 878: "science fiction",
  10770: "tv movie", 53: "thriller", 10752: "war", 37: "western",
  10759: "action & adventure", 10762: "kids", 10763: "news",
  10764: "reality", 10765: "sci-fi & fantasy", 10766: "soap",
  10767: "talk", 10768: "war & politics"
};

// ─── Genre styles ─────────────────────────────────────────────────────────────
const GENRE_STYLES = {
  horror: {
    mood:    "terrifying, psychologically disturbing, pure dread",
    palette: "near-black shadows, icy desaturated blues, single harsh beam of light, deep crimson accents",
    lighting: "extreme chiaroscuro, single source horror lighting, long menacing shadows",
  },
  thriller: {
    mood:    "paranoid, tense, dangerous, unpredictable",
    palette: "cold steel blues, charcoal greys, sickly yellow streetlight, heavy shadows",
    lighting: "noir-style underlit, harsh side lighting, shadowy silhouettes",
  },
  "science fiction": {
    mood:    "awe-inspiring, vast, lonely, futuristic",
    palette: "deep space blacks, electric blues, neon cyan accents, warm orange planet glow",
    lighting: "volumetric light rays, soft bioluminescent glow, dramatic rim lighting",
  },
  "sci-fi & fantasy": {
    mood:    "epic, otherworldly, mythic, awe-inspiring",
    palette: "deep cosmic purples, electric blues, gold and amber accents, glowing runes",
    lighting: "dramatic magical lighting, god rays, glowing energy sources",
  },
  action: {
    mood:    "explosive, intense, relentless, heroic",
    palette: "fiery oranges, deep blacks, intense reds, smoldering smoke tones",
    lighting: "high contrast explosion backlight, dramatic rim light on hero, dynamic motion blur",
  },
  "action & adventure": {
    mood:    "thrilling, dangerous, epic, high-stakes",
    palette: "warm golden dust, deep shadows, explosive orange, cool steel blues",
    lighting: "cinematic golden hour backlight, dramatic contrast, hero silhouette",
  },
  adventure: {
    mood:    "epic, grand, exciting, larger than life",
    palette: "rich jungle greens, warm golden sunlight, dramatic sky blues, earthy tones",
    lighting: "dramatic natural sunlight, long golden shadows, volumetric rays through trees",
  },
  romance: {
    mood:    "intimate, passionate, emotionally charged, bittersweet",
    palette: "warm amber, soft rose gold, candlelight ivory, deep shadow blues",
    lighting: "soft warm practical lighting, intimate candlelight, gentle bokeh background",
  },
  comedy: {
    mood:    "energetic, fun, vibrant, charismatic",
    palette: "warm bright tones, vivid saturated colors, clean whites, playful accents",
    lighting: "bright even lighting, clean studio look, warm cheerful tones",
  },
  animation: {
    mood:    "magical, vibrant, imaginative, wondrous",
    palette: "vivid jewel tones, luminous glowing colors, rich saturated hues",
    lighting: "magical glowing light sources, volumetric sparkles, warm magical atmosphere",
  },
  fantasy: {
    mood:    "epic, mythical, grand, mystical",
    palette: "deep jewel purples, emerald greens, molten gold, ancient bronze",
    lighting: "dramatic magical lighting, god rays, fire and mystical energy glow",
  },
  crime: {
    mood:    "gritty, dark, morally complex, dangerous",
    palette: "wet asphalt blues, harsh neon signs, deep blacks, smoky greys",
    lighting: "harsh neon backlight, wet pavement reflections, deep noir shadows",
  },
  drama: {
    mood:    "emotionally intense, raw, deeply human, powerful",
    palette: "warm amber and shadow, muted earth tones, deep contrast",
    lighting: "intimate natural window light, soft dramatic shadows, emotional close-up lighting",
  },
  war: {
    mood:    "gritty, brutal, heroic, devastating",
    palette: "muted olive greens, smoke greys, blood reds, harsh whites",
    lighting: "harsh battlefield lighting, explosion rim light, smoke diffusion, overcast grey",
  },
  western: {
    mood:    "rugged, lonely, epic, dusty, timeless",
    palette: "warm desert golds, burnt orange, dust brown, deep sunset reds",
    lighting: "dramatic desert sunset backlight, long golden shadows, harsh midday sun",
  },
  history: {
    mood:    "grand, epic, timeless, powerful",
    palette: "rich warm golds, deep earthy browns, aged bronze, deep shadow blacks",
    lighting: "dramatic torchlight or sunlight, period-accurate natural lighting, painterly shadows",
  },
  mystery: {
    mood:    "suspicious, atmospheric, enigmatic, unsettling",
    palette: "deep foggy blues, muted greens, amber lamplight, heavy shadows",
    lighting: "atmospheric fog diffusion, single practical lamp, heavy vignette shadows",
  },
  family: {
    mood:    "warm, exciting, heartfelt, adventurous",
    palette: "warm sunny yellows, vivid blues, rich greens, bright cheerful tones",
    lighting: "warm golden natural light, bright and inviting, soft shadows",
  },
  default: {
    mood:    "cinematic, dramatic, powerful, atmospheric",
    palette: "rich deep tones, dramatic contrast, cinematic color grading",
    lighting: "dramatic cinematic lighting, strong shadows, professional film look",
  }
};

// ─── Artistic style variants (her film farklı görünsün) ──────────────────────
const ARTISTIC_STYLES = [
  {
    label: "vintage_painted",
    base:  "classic 1950s Hollywood hand-painted movie poster, oil painting illustration style, dramatic painted characters",
    tech:  "painterly oil texture, vintage grain overlay, period-accurate illustration",
  },
  {
    label: "retro_pulp",
    base:  "1960s retro pulp fiction paperback cover art, bold graphic illustration, dramatic pulp composition",
    tech:  "strong ink outlines, flat cel shading, halftone texture, pulp paperback aesthetic",
  },
  {
    label: "noir_illustrated",
    base:  "dark noir movie poster, moody ink wash illustration, black and white with selective color, hard-boiled aesthetic",
    tech:  "heavy shadows, wet street reflections, heavy vignette, noir atmosphere",
  },
  {
    label: "epic_photorealistic",
    base:  "ultra-realistic cinematic movie poster photograph, photorealistic 8K professional film poster, shot on ARRI camera anamorphic lens",
    tech:  "dramatic rim lighting, deep blacks, cinematic color grading, anamorphic lens flare",
  },
  {
    label: "painterly_epic",
    base:  "epic concept art painting style movie poster, highly detailed digital oil painting, dramatic painterly illustration",
    tech:  "rich jewel tones matching story mood, dramatic god rays, painterly brush detail",
  },
  {
    label: "retro_scifi",
    base:  "1970s retro science fiction movie poster, vintage sci-fi paperback illustration, retrofuturism aesthetic",
    tech:  "chrome highlights, neon glow, vintage halftone dots, retro future design",
  },
  {
    label: "graphic_novel",
    base:  "graphic novel movie poster, bold sequential art illustration, strong dynamic composition, Frank Miller inspired",
    tech:  "bold ink lines, dramatic panel composition, high contrast graphic art",
  },
  {
    label: "watercolor_atmospheric",
    base:  "atmospheric watercolor illustration movie poster, loose expressive watercolor painting, impressionistic cinematic mood",
    tech:  "soft watercolor bleeds, luminous washes, delicate linework, painterly texture",
  },
  {
    label: "soviet_constructivist",
    base:  "bold constructivist propaganda poster style, strong geometric composition, dramatic angular figures, Rodchenko inspired",
    tech:  "strong diagonal lines, high contrast geometric shapes, flat graphic boldness",
  },
  {
    label: "modern_art_house",
    base:  "modern art house film poster, clean bold photographic composition, A24 film aesthetic",
    tech:  "stark contrast, generous negative space, minimal but striking design",
  },
];

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(title, year, type, genreIds, overview, cast = [], keywords = []) {
  const ids        = (genreIds || "").split(",").map(Number).filter(Boolean);
  const genreNames = ids.map(id => GENRE_MAP[id]).filter(Boolean);
  const primary    = genreNames[0] || "default";
  const s          = GENRE_STYLES[primary] || GENRE_STYLES.default;
  const mediaLabel = type === "series" ? "TV series" : "film";
  const plotHint   = overview ? overview.substring(0, 150) : "";

  // Title hash ile her film için deterministik ama farklı bir artistik stil seç
  const titleHash = [...(title || "x")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const artStyle  = ARTISTIC_STYLES[titleHash % ARTISTIC_STYLES.length];

  // Cast ve keyword zenginleştirmesi
  const castHint    = cast.length    ? `featuring characters inspired by ${cast.join(", ")}` : "";
  const keywordHint = keywords.length ? `themes: ${keywords.slice(0, 4).join(", ")}` : "";

  const prompt = [
    artStyle.base,
    `movie poster for the ${mediaLabel} "${title}"${year ? ` (${year})` : ""}`,
    plotHint ? `story: ${plotHint}` : "",
    castHint,
    keywordHint,
    `mood: ${s.mood}`,
    artStyle.tech,
    "portrait orientation 2:3 aspect ratio",
    "dramatic cinematic composition with compelling characters",
    "professional poster layout, visually striking, unique design",
    "avoid: yellow backgrounds, orange backgrounds, red backgrounds, warm toned backgrounds, fire imagery unless story requires it, generic Hollywood poster clichés, repetitive color schemes, monochromatic warm palettes"
  ].filter(Boolean).join(", ");

  return { prompt, styleLabel: `${primary}_${artStyle.label}` };
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function posterPublicId(title, year) {
  const safe = (title || "unknown").replace(/[^a-z0-9]/gi, "_").toLowerCase().substring(0, 80);
  return `${CLD_FOLDER}/${POSTER_VERSION}_${safe}_${year || "0"}`;
}

function posterKey(title, year) {
  const safe = (title || "unknown").replace(/[^a-z0-9]/gi, "_").toLowerCase().substring(0, 80);
  return `${POSTER_VERSION}_${safe}_${year || "0"}`;
}

function posterUrl(title, year) {
  return `${CLD_BASE}/${posterKey(title, year)}.jpg`;
}

function processQueue() {
  if (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    const next = requestQueue.shift();
    next().catch(err => {
      console.error(`[Queue] Unhandled task error: ${err.message}`);
    }).finally(() => {
      activeRequests--;
      processQueue();
    });
  }
}

// ─── Cloudinary helpers ───────────────────────────────────────────────────────

async function existsInCloudinary(title, year) {
  try {
    const url = posterUrl(title, year);
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function uploadToCloudinary(title, year, buffer) {
  const publicId  = posterPublicId(title, year);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Cloudinary signature: sorted params, no folder field, append secret directly
  const toSign    = `public_id=${publicId}&timestamp=${timestamp}${CLD_SECRET}`;
  const signature = crypto.createHash("sha256").update(toSign).digest("hex");

  // Build multipart form
  const boundary = "----RetromioB" + Date.now();
  const CRLF     = "\r\n";

  const fields = {
    api_key:   CLD_KEY,
    timestamp,
    public_id: publicId,
    signature
  };

  let body = "";
  for (const [k, v] of Object.entries(fields)) {
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}`;
    body += `${v}${CRLF}`;
  }
  body += `--${boundary}${CRLF}`;
  body += `Content-Disposition: form-data; name="file"; filename="poster.jpg"${CRLF}`;
  body += `Content-Type: image/jpeg${CRLF}${CRLF}`;

  const prefix = Buffer.from(body, "binary");
  const suffix = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, "binary");
  const full   = Buffer.concat([prefix, buffer, suffix]);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`, {
    method:  "POST",
    headers: {
      "Content-Type":   `multipart/form-data; boundary=${boundary}`,
      "Content-Length": full.length.toString()
    },
    body: full
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Cloudinary upload failed ${res.status}: ${txt}`);
  }

  const json = await res.json();
  console.log(`[Cloudinary] Uploaded: ${json.public_id} (${json.bytes} bytes)`);
  return json.secure_url;
}

// ─── TMDB enrichment: credits + keywords ─────────────────────────────────────

async function fetchTmdbEnrichment(tmdbId, mediaType) {
  if (!tmdbId) return { cast: [], keywords: [] };
  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const kwField  = mediaType === "series" ? "results" : "keywords";
  try {
    const [creditsRes, kwRes] = await Promise.all([
      fetch(`${TMDB_BASE}/${tmdbType}/${tmdbId}/credits?api_key=${TMDB_API_KEY}`, { timeout: 8000 }),
      fetch(`${TMDB_BASE}/${tmdbType}/${tmdbId}/keywords?api_key=${TMDB_API_KEY}`, { timeout: 8000 }),
    ]);
    const [creditsData, kwData] = await Promise.all([creditsRes.json(), kwRes.json()]);
    const cast     = (creditsData.cast || []).slice(0, 3).map(c => c.name);
    const keywords = (kwData[kwField] || []).slice(0, 6).map(k => k.name);
    return { cast, keywords };
  } catch (err) {
    console.warn(`[AI] TMDB enrichment failed: ${err.message}`);
    return { cast: [], keywords: [] };
  }
}

// ─── Replicate generation ─────────────────────────────────────────────────────

const TMDB_BASE      = `https://api.themoviedb.org/3`;
const ANIMATION_GENRE = 16;

async function _executeGenerate(title, year, type, genreIds, overview, tmdbPosterUrl, tmdbId) {
  const ids         = (genreIds || "").split(",").map(Number).filter(Boolean);
  const isAnimation = ids.includes(ANIMATION_GENRE);

  // TMDB credits + keywords ile prompt zenginleştir
  const mediaType = type === "series" ? "tv" : "movie";
  const { cast, keywords } = await fetchTmdbEnrichment(tmdbId, mediaType);

  const { prompt: basePrompt, styleLabel } = buildPrompt(title, year, type, genreIds, overview, cast, keywords);
  const seed = Math.abs([...(title || "x")].reduce((a, c) => a + c.charCodeAt(0), 0));

  const now     = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const wait = MIN_REQUEST_INTERVAL_MS - elapsed;
    console.log(`[AI] Rate-limit gate: waiting ${wait}ms`);
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  let modelUrl, inputBody;

  if (isAnimation && tmdbPosterUrl) {
    // Animasyon: flux-dev img2img — TMDB karakterlerini koru, stil uygula
    try {
      console.log(`[AI] Animation img2img — downloading TMDB poster: ${tmdbPosterUrl}`);
      const tmdbRes = await fetch(tmdbPosterUrl, { timeout: 10000 });
      if (!tmdbRes.ok) throw new Error(`TMDB poster fetch failed: ${tmdbRes.status}`);
      const b64     = Buffer.from(await tmdbRes.arrayBuffer()).toString("base64");
      const dataUri = `data:image/jpeg;base64,${b64}`;

      modelUrl  = "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions";
      inputBody = {
        prompt:              `${basePrompt}, vibrant animated movie poster style, preserve character designs and colors`,
        image:               dataUri,
        prompt_strength:     0.70,
        width:               512,
        height:              768,
        num_inference_steps: 28,
        guidance:            3.5,
        seed,
        output_format:       "jpg",
        output_quality:      90,
      };
      console.log(`[AI] flux-dev img2img for animation: "${title}"`);
    } catch (err) {
      console.warn(`[AI] Animation img2img failed, falling back: ${err.message}`);
      isAnimation && (modelUrl = null);
    }
  }

  if (!modelUrl) {
    // Tüm türler: flux-dev text2img — prompt takibi güçlü, stil çeşitliliği gerçek
    modelUrl  = "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions";
    inputBody = {
      prompt:              basePrompt,
      width:               512,
      height:              768,
      num_inference_steps: 28,
      guidance:            3.5,
      seed,
      output_format:       "jpg",
      output_quality:      90,
    };
    console.log(`[AI] flux-dev text2img (style: ${styleLabel}): "${title}"`);
  }

  const createRes = await fetch(modelUrl, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_TOKEN}`,
      "Content-Type":  "application/json",
      "Prefer":        "wait"
    },
    body: JSON.stringify({ input: inputBody })
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    const err  = new Error(`Replicate ${createRes.status}: ${txt.substring(0, 200)}`);
    err.status = createRes.status;
    throw err;
  }

  let prediction = await createRes.json();
  console.log(`[AI] Prediction ${prediction.id} — status: ${prediction.status}`);

  const maxWait = 120000;
  const started = Date.now();
  while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
    if (Date.now() - started > maxWait) throw new Error("Replicate timeout");
    await new Promise(r => setTimeout(r, 2000));
    const pollRes  = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { "Authorization": `Bearer ${REPLICATE_TOKEN}` }
    });
    prediction = await pollRes.json();
    console.log(`[AI] Polling ${prediction.id} — ${prediction.status}`);
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || "unknown"}`);
  }

  const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!imageUrl) throw new Error("Replicate returned no image URL");

  console.log(`[AI] Downloading: ${imageUrl}`);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image download failed ${imgRes.status}`);

  const buffer = Buffer.from(await imgRes.arrayBuffer());
  if (buffer.length < 1000) throw new Error(`Image too small (${buffer.length} bytes)`);

  console.log(`[AI] Generated: "${title}" (${buffer.length} bytes)`);
  return buffer;
}

async function generatePoster(title, year, type, genreIds, overview, tmdbPosterUrl, tmdbId) {
  if (!REPLICATE_TOKEN)        throw new Error("REPLICATE_TOKEN not set");
  if (replicateQuotaExhausted) throw new Error("Replicate quota exhausted");

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[AI] Generating (attempt ${attempt}/${MAX_RETRIES}): "${title}"`);
      return await _executeGenerate(title, year, type, genreIds, overview, tmdbPosterUrl, tmdbId);
    } catch (err) {
      if (err.status === 402) {
        replicateQuotaExhausted = true;
        console.warn(`[AI] Replicate 402 — insufficient credit. Falling back to TMDB.`);
        throw err;
      }
      if (err.status === 429) {
        if (attempt >= MAX_RETRIES) {
          console.warn(`[AI] Replicate 429 — max retries reached for "${title}". Skipping.`);
          throw new Error(`Replicate rate limited after ${MAX_RETRIES} attempts`);
        }
        const delay = 20000 * attempt;
        console.warn(`[AI] Replicate 429. Retry ${attempt}/${MAX_RETRIES} in ${delay/1000}s…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ─── Main: trigger background generation ─────────────────────────────────────

function triggerPoster(title, year, type, genreIds, overview, tmdbPosterUrl, tmdbId) {
  if (!title) return;
  const key = posterKey(title, year);
  if (AI_PENDING.has(key)) return;

  const promise = new Promise((resolve, reject) => {
    const task = async () => {
      try {
        const exists = await existsInCloudinary(title, year);
        if (exists) {
          console.log(`[AI] Cache hit in Cloudinary: ${key}`);
          resolve();
          return;
        }

        const buf = await generatePoster(title, year, type, genreIds, overview, tmdbPosterUrl, tmdbId);
        await uploadToCloudinary(title, year, buf);
        console.log(`[AI] Stored in Cloudinary: ${key}`);
        resolve();
      } catch (err) {
        console.error(`[AI] Failed for "${title}": ${err.message}`);
        reject(err);
      } finally {
        AI_PENDING.delete(key);
      }
    };

    requestQueue.push(task);
    processQueue();
  });

  AI_PENDING.set(key, promise);
}

// ─── Status ───────────────────────────────────────────────────────────────────

function getQueueStatus() {
  return {
    active:         activeRequests,
    queued:         requestQueue.length,
    pending:        AI_PENDING.size,
    max:            MAX_CONCURRENT,
    provider:       "Replicate + Cloudinary",
    quotaExhausted: replicateQuotaExhausted
  };
}

// ─── Exports (B2 compat shims for server.js) ──────────────────────────────────
// server.js references existsInB2 and B2_PUBLIC — provide shims so it still works

async function existsInB2(title, year) {
  return existsInCloudinary(title, year);
}

module.exports = {
  triggerPoster,
  posterUrl,
  posterKey,
  existsInB2,         // shim
  uploadToB2: uploadToCloudinary, // shim
  generatePoster,
  getQueueStatus,
  B2_PUBLIC: CLD_BASE, // shim
  AI_PENDING,
  MAX_CONCURRENT,
  requestQueue
};
