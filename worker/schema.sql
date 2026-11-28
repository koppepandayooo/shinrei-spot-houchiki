-- ランキング用のテーブル（D1）
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,           -- 端末ごとのプレイヤーID（ゲームが自動で作る）
  name TEXT NOT NULL,            -- 表示名（12文字まで）
  score REAL NOT NULL,           -- いまのシーズン（ランキングのリセット後）の獲得フィルム（最高記録）
  spot INTEGER NOT NULL DEFAULT 1,
  rebirths INTEGER NOT NULL DEFAULT 0,
  photos INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL       -- 最終更新（ミリ秒）
);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);

-- 送信間隔の制限用（id ごと・IP のハッシュごと）
CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);

-- チャット（7日・500件より古いものは自動で消える）
CREATE TABLE IF NOT EXISTS chat (
  no INTEGER PRIMARY KEY AUTOINCREMENT, -- 書き込みの番号（新しいほど大きい）
  pid TEXT NOT NULL,             -- 書き込んだプレイヤーの id（表示しない。荒らしの削除用）
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL            -- 書き込んだ時刻（ミリ秒）
);
CREATE INDEX IF NOT EXISTS idx_chat_at ON chat (at);

-- 開発者への意見・不具合報告（開発者だけが読む）
CREATE TABLE IF NOT EXISTS feedback (
  no INTEGER PRIMARY KEY AUTOINCREMENT,
  pid TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,            -- 要望／不具合／感想／その他
  text TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '', -- ゲームのバージョン
  at INTEGER NOT NULL
);

-- 毎時0分・30分の時点で固定したランキング（表示はいつもここから。直近2回分だけ残す）
CREATE TABLE IF NOT EXISTS snap_meta (
  slot INTEGER PRIMARY KEY,      -- 何時何分の時点か（ミリ秒）
  at INTEGER NOT NULL            -- 実際に保存した時刻
);
CREATE TABLE IF NOT EXISTS snap_scores (
  slot INTEGER NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  score REAL NOT NULL,
  spot INTEGER NOT NULL DEFAULT 1,
  rebirths INTEGER NOT NULL DEFAULT 0,
  photos INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  PRIMARY KEY (slot, id)
);
CREATE INDEX IF NOT EXISTS idx_snap_score ON snap_scores (slot, score DESC);
