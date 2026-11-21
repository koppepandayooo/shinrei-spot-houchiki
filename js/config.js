'use strict';
/* =========================================================
 * 設定
 * ========================================================= */

// ランキングの受け口（Cloudflare Workers の URL）。
// worker/ フォルダの手順でデプロイしたら、表示された URL をここに書く。
// 例：'https://shinrei-ranking.あなたのサブドメイン.workers.dev'
// 空のままなら、ランキングは「準備中」と表示されるだけで、ゲームは普通に遊べる。
const RANKING_API = 'https://shinrei-ranking.koppepandayooo.workers.dev';

// ランキングの「シーズン」番号。ランキングをリセットするときに1つ増やす。
// スコアは「このシーズンが始まってから獲得したフィルム」になる（セーブや進行状況はそのまま）。
// サーバー側（worker/wrangler.jsonc の RANK_SEASON）も同じ番号にすること。
const RANK_SEASON = 2;
