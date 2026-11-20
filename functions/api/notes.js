/**
 * 留言板公开接口（Cloudflare Pages Functions + D1）
 * GET  /api/notes  -> 获取已审核通过 (status = 'approved') 的留言列表
 * POST /api/notes  -> 提交新留言（默认 status = 'pending'，人工审核后才放出）
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ ok: false, error: 'DB_NOT_BOUND', notes: [] }, 503);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, nickname, content, favorite_movie, created_at
     FROM notes
     WHERE status = 'approved'
     ORDER BY id DESC
     LIMIT 300`
  ).all();
  return json({ ok: true, notes: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ ok: false, error: 'DB_NOT_BOUND' }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const nickname = String(body.nickname || '').trim().slice(0, 40);
  const content = String(body.content || '').trim().slice(0, 600);
  const favoriteMovie = String(body.favorite_movie || '').trim().slice(0, 80);

  if (!nickname) return json({ ok: false, error: '请填写昵称' }, 400);
  if (!content) return json({ ok: false, error: '请填写留言内容' }, 400);

  const createdAt = new Date().toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO notes (nickname, content, favorite_movie, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`
  )
    .bind(nickname, content, favoriteMovie, createdAt)
    .run();

  return json({
    ok: true,
    id: res.meta?.last_row_id || null,
    status: 'pending',
    created_at: createdAt,
    message: '留言已收到，审核通过后将在展厅留言板展示。',
  }, 201);
}
