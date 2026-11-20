-- 幕间漫游 · 留言板 Cloudflare D1 表结构
-- 执行初始化：wrangler d1 execute mjmy-notes --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  favorite_movie TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at TEXT NOT NULL,
  reviewed_at TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_notes_status_created ON notes (status, created_at DESC);

-- 展览预置留言。重复执行初始化时保留已有记录及其审核状态。
INSERT INTO notes (nickname, content, favorite_movie, status, created_at, reviewed_at)
SELECT '阿呆', '慢慢学着如何感受失去', '机器人之梦', 'approved',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (
  SELECT 1 FROM notes
  WHERE nickname = '阿呆'
    AND content = '慢慢学着如何感受失去'
    AND favorite_movie IN ('机器人之梦', '《机器人之梦》')
);
