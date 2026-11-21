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
