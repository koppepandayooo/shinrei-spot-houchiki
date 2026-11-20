/**
 * 心霊スポット放置記 ランキング API（Cloudflare Workers + D1）
 *
 *   GET  /api/ranking?limit=50&id=<playerId>  … 上位のランキング（id を付けると自分の順位も返す）
 *   POST /api/score                           … スコアを送信（同じ id は最高記録だけ残す）
 *
 * ログインなしの「名前を入力するだけ」方式なので、スコアは自己申告です。
 * 入力チェック・送信間隔の制限（id ごと・IP ごと）で、いたずらをある程度防ぎます。
 */

const NAME_MAX = 12;
const MIN_INTERVAL_MS = 20_000; // 同じ id / IP からの送信は20秒に1回まで
const MAX_BODY = 2048;
const MAX_SCORE = 1e300;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin'), env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    }
    try {
      if (url.pathname === '/api/ranking' && request.method === 'GET') {
        return await getRanking(url, env, cors);
      }
      if (url.pathname === '/api/score' && request.method === 'POST') {
        if (!cors) return json({ error: 'origin_not_allowed' }, 403, null);
        return await postScore(request, env, cors);
      }
      return json({ error: 'not_found' }, 404, cors);
    } catch (e) {
      console.error(
        JSON.stringify({ message: 'request failed', path: url.pathname, error: e instanceof Error ? e.message : String(e) })
      );
      return json({ error: 'server_error' }, 500, cors);
    }
  },
};

/* 許可したサイト（GitHub Pages など）からの呼び出しだけ CORS を許可する */
function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, cors, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(cors || {}), ...extra },
  });
}

async function getRanking(url, env, cors) {
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const id = url.searchParams.get('id') || '';
  const { results } = await env.DB.prepare(
    'SELECT id, name, score, spot, rebirths, photos FROM scores ORDER BY score DESC, updated ASC LIMIT ?'
  )
    .bind(limit)
    .all();
  const entries = results.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    spot: r.spot,
    rebirths: r.rebirths,
    photos: r.photos,
    me: !!id && r.id === id,
  }));
  let me = null;
  if (ID_RE.test(id)) {
    const row = await env.DB.prepare(
      'SELECT score, (SELECT COUNT(*) FROM scores s2 WHERE s2.score > s1.score) + 1 AS rank FROM scores s1 WHERE id = ?'
    )
      .bind(id)
      .first();
    if (row) me = { rank: row.rank, score: row.score };
  }
  return json({ entries, me }, 200, cors, { 'Cache-Control': 'no-store' });
}

async function postScore(request, env, cors) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json({ error: 'too_large' }, 413, cors);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413, cors);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_json' }, 400, cors);
  }

  // 入力チェック
  const id = String(body.id || '');
  if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400, cors);
  const name = cleanName(body.name);
  if (!name) return json({ error: 'bad_name' }, 400, cors);
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return json({ error: 'bad_score' }, 400, cors);
  const spot = clampInt(body.spot, 1, 5);
  const rebirths = clampInt(body.rebirths, 0, 1_000_000);
  const photos = clampInt(body.photos, 0, 100_000_000);

  // 送信間隔の制限（id ごと・IP ごと）
  const now = Date.now();
  const ipKey = 'ip:' + (await sha256Hex((request.headers.get('CF-Connecting-IP') || 'unknown') + (env.IP_SALT || ''))).slice(0, 24);
  const idKey = 'id:' + id;
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate WHERE key IN (?, ?) AND at > ?')
    .bind(idKey, ipKey, now - MIN_INTERVAL_MS)
    .first();
  if (recent && recent.n > 0) return json({ error: 'too_many_requests' }, 429, cors, { 'Retry-After': '20' });

  // 保存（同じ id は最高記録を残す）
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO scores (id, name, score, spot, rebirths, photos, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         score = MAX(scores.score, excluded.score),
         spot = MAX(scores.spot, excluded.spot),
         rebirths = MAX(scores.rebirths, excluded.rebirths),
         photos = MAX(scores.photos, excluded.photos),
         updated = excluded.updated`
    ).bind(id, name, score, spot, rebirths, photos, now),
    env.DB.prepare('INSERT INTO rate (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(idKey, now),
    env.DB.prepare('INSERT INTO rate (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(ipKey, now),
  ]);

  const row = await env.DB.prepare(
    'SELECT score, (SELECT COUNT(*) FROM scores s2 WHERE s2.score > s1.score) + 1 AS rank FROM scores s1 WHERE id = ?'
  )
    .bind(id)
    .first();
  console.log(JSON.stringify({ message: 'score saved', rank: row ? row.rank : null }));
  return json({ ok: true, rank: row ? row.rank : null, best: row ? row.score : score }, 200, cors);
}

function cleanName(v) {
  const s = String(v ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, NAME_MAX).join('');
}

function clampInt(v, min, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
