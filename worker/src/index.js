/**
 * 心霊スポット放置記 ランキング API（Cloudflare Workers + D1）
 *
 *   GET  /api/ranking?limit=50&id=<playerId>  … 上位のランキング（id を付けると自分の順位も返す）
 *   POST /api/score                           … スコアを送信（同じ id は最高記録だけ残す）
 *   POST /api/delete                          … 自分の記録を削除（ゲームのデータ削除のとき）
 *   GET  /api/chat?after=<番号>               … チャットの最新の書き込み（after より新しいものだけ）
 *   POST /api/chat                            … チャットに書き込む
 *   POST /api/feedback                        … 開発者への意見・不具合報告を送る（読むのは開発者だけ）
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
      if (url.pathname === '/api/delete' && request.method === 'POST') {
        if (!cors) return json({ error: 'origin_not_allowed' }, 403, null);
        return await deleteScore(request, env, cors);
      }
      if (url.pathname === '/api/chat' && request.method === 'GET') {
        return await getChat(url, env, cors);
      }
      if (url.pathname === '/api/chat' && request.method === 'POST') {
        if (!cors) return json({ error: 'origin_not_allowed' }, 403, null);
        return await postChat(request, env, cors);
      }
      if (url.pathname === '/api/feedback' && request.method === 'POST') {
        if (!cors) return json({ error: 'origin_not_allowed' }, 403, null);
        return await postFeedback(request, env, cors);
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
  const spot = clampInt(body.spot, 1, 8); // 1〜7 = 通常スポット（弱い順）、8 = 隠しスポット
  const rebirths = clampInt(body.rebirths, 0, 1_000_000);
  const photos = clampInt(body.photos, 0, 100_000_000);
  // ランキングのシーズン（リセットのたびに1つ増える）。違うシーズンのスコアは受け付けない
  const season = Number(env.RANK_SEASON || 1);
  if (Number(body.season || 1) !== season) return json({ error: 'old_season' }, 409, cors);

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

/* 自分の記録を削除する。id は各端末だけが知っている合言葉の役割（ランキングには表示しない） */
async function deleteScore(request, env, cors) {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413, cors);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad_json' }, 400, cors);
  }
  const id = String(body.id || '');
  if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400, cors);
  const res = await env.DB.batch([
    env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(id),
    env.DB.prepare('DELETE FROM rate WHERE key = ?').bind('id:' + id),
  ]);
  const deleted = res[0] && res[0].meta ? res[0].meta.changes : 0;
  console.log(JSON.stringify({ message: 'score deleted', deleted }));
  return json({ ok: true, deleted }, 200, cors);
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

/* ================= チャット ================= */
const CHAT_MAX = 80; // 1回の書き込みの文字数
const CHAT_INTERVAL_MS = 5_000; // 同じ人・同じ IP からの書き込みは5秒に1回まで
const CHAT_KEEP_MS = 7 * 24 * 3600 * 1000; // 7日たった書き込みは消す
const CHAT_KEEP_ROWS = 500; // 残すのは新しい500件まで
const CHAT_LIST = 50; // 一度に返す件数
// 伏せ字にする言葉（ひどい言葉・連絡先の交換につながりやすい言葉）
const NG_WORDS = [
  '死ね', 'しね', 'シネ', '殺す', 'ころす', 'コロス', '消えろ', 'きえろ', '殺害',
  'うざい', 'ウザい', 'ウザイ', 'きもい', 'キモい', 'キモイ', 'ブス', 'ぶす', 'クズ', 'くず', 'カス', 'ゴミが',
  'ばか', 'バカ', '馬鹿', 'あほ', 'アホ', 'ちんこ', 'ちんぽ', 'まんこ', 'セックス', 'sex', 'fuck', 'shit',
  'line交換', 'ライン交換', 'lineid', 'ラインid', 'カカオ', 'インスタ教えて', '電話番号', '住所教えて',
];

function cleanText(s, max) {
  return Array.from(
    String(s || '')
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
    .slice(0, max)
    .join('');
}
// URL・メールアドレス・長い数字（電話番号など）と、NG ワードを伏せ字にする
function maskText(s) {
  let t = s
    .replace(/(https?:\/\/|www\.)\S+/gi, '＊＊＊')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '＊＊＊')
    .replace(/[0-9０-９][0-9０-９\-ー－ ]{8,}[0-9０-９]/g, '＊＊＊');
  const low = t.toLowerCase();
  for (const w of NG_WORDS) {
    let i = low.indexOf(w.toLowerCase());
    while (i >= 0) {
      t = t.slice(0, i) + '＊'.repeat(w.length) + t.slice(i + w.length);
      i = t.toLowerCase().indexOf(w.toLowerCase(), i + w.length);
    }
  }
  return t;
}
// 送信間隔の制限（keys のどれかが ms 以内に使われていたら true）
async function rateLimited(env, keys, ms, now) {
  const marks = keys.map(() => '?').join(', ');
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM rate WHERE key IN (${marks}) AND at > ?`)
    .bind(...keys, now - ms)
    .first();
  return !!(row && row.n > 0);
}
const rateMark = (env, key, now) =>
  env.DB.prepare('INSERT INTO rate (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(key, now);
async function ipHash(request, env) {
  return (await sha256Hex((request.headers.get('CF-Connecting-IP') || 'unknown') + (env.IP_SALT || ''))).slice(0, 24);
}

async function getChat(url, env, cors) {
  const after = Math.max(0, parseInt(url.searchParams.get('after') || '0', 10) || 0);
  const { results } = await env.DB.prepare('SELECT no, name, text, at FROM chat WHERE no > ? ORDER BY no DESC LIMIT ?')
    .bind(after, CHAT_LIST)
    .all();
  // 古い順にして返す（プレイヤーの id は返さない）
  return json({ messages: (results || []).reverse() }, 200, cors);
}

async function postChat(request, env, cors) {
  const text0 = await request.text();
  if (text0.length > MAX_BODY) return json({ error: 'too_large' }, 413, cors);
  let body;
  try {
    body = JSON.parse(text0);
  } catch {
    return json({ error: 'bad_json' }, 400, cors);
  }
  const id = String(body.id || '');
  if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400, cors);
  const name = cleanName(body.name);
  if (!name) return json({ error: 'bad_name' }, 400, cors);
  const text = maskText(cleanText(body.text, CHAT_MAX));
  if (!text) return json({ error: 'empty' }, 400, cors);

  const now = Date.now();
  const idKey = 'chat-id:' + id;
  const ipKey = 'chat-ip:' + (await ipHash(request, env));
  if (await rateLimited(env, [idKey, ipKey], CHAT_INTERVAL_MS, now)) {
    return json({ error: 'too_many_requests' }, 429, cors, { 'Retry-After': '5' });
  }
  await env.DB.batch([
    env.DB.prepare('INSERT INTO chat (pid, name, text, at) VALUES (?, ?, ?, ?)').bind(id, name, text, now),
    rateMark(env, idKey, now),
    rateMark(env, ipKey, now),
    // 古い書き込みの片付け
    env.DB.prepare('DELETE FROM chat WHERE at < ?').bind(now - CHAT_KEEP_MS),
    env.DB.prepare('DELETE FROM chat WHERE no <= (SELECT no FROM chat ORDER BY no DESC LIMIT 1 OFFSET ?)').bind(CHAT_KEEP_ROWS),
  ]);
  return json({ ok: true }, 200, cors);
}

/* ================= 意見・不具合報告（開発者だけが読む） ================= */
const FEEDBACK_MAX = 1000;
const FEEDBACK_INTERVAL_MS = 60_000; // 同じ人・同じ IP からは1分に1回まで
const FEEDBACK_KINDS = ['要望', '不具合', '感想', 'その他'];

async function postFeedback(request, env, cors) {
  const text0 = await request.text();
  if (text0.length > 8192) return json({ error: 'too_large' }, 413, cors);
  let body;
  try {
    body = JSON.parse(text0);
  } catch {
    return json({ error: 'bad_json' }, 400, cors);
  }
  const id = String(body.id || '');
  if (!ID_RE.test(id)) return json({ error: 'bad_id' }, 400, cors);
  const kind = FEEDBACK_KINDS.includes(body.kind) ? body.kind : 'その他';
  const text = Array.from(String(body.text || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim())
    .slice(0, FEEDBACK_MAX)
    .join('');
  if (!text) return json({ error: 'empty' }, 400, cors);
  const name = cleanName(body.name) || '';
  const version = String(body.version || '').slice(0, 20);

  const now = Date.now();
  const idKey = 'fb-id:' + id;
  const ipKey = 'fb-ip:' + (await ipHash(request, env));
  if (await rateLimited(env, [idKey, ipKey], FEEDBACK_INTERVAL_MS, now)) {
    return json({ error: 'too_many_requests' }, 429, cors, { 'Retry-After': '60' });
  }
  await env.DB.batch([
    env.DB.prepare('INSERT INTO feedback (pid, name, kind, text, version, at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, kind, text, version, now),
    rateMark(env, idKey, now),
    rateMark(env, ipKey, now),
  ]);
  console.log(JSON.stringify({ message: 'feedback received', kind }));
  return json({ ok: true }, 200, cors);
}
