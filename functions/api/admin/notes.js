/**
 * 留言板管理员审核接口（需 Header: x-admin-key 匹配任一管理员密码）
 * GET    /api/admin/notes        -> 拉取全部留言（pending / approved / rejected）
 * PATCH  /api/admin/notes        -> 批量或单条修改 status ({ id, status } 或 { items: [...] })
 * DELETE /api/admin/notes?id=123 -> 删除单条留言
 */

import { isAdminPasswordValid } from '../../_admin-auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function checkAuth(request, env) {
  return isAdminPasswordValid(request.headers.get('x-admin-key'), env);
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB_NOT_BOUND' }, 503);
  const { results } = await env.DB.prepare(
    `SELECT id, nickname, content, favorite_movie, status, created_at, reviewed_at
     FROM notes
     ORDER BY id DESC`
  ).all();
  return json({ ok: true, notes: results || [] });
}

export async function onRequestPatch({ request, env }) {
  if (!checkAuth(request, env)) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB_NOT_BOUND' }, 503);

  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'INVALID_JSON' }, 400); }

  const items = Array.isArray(body.items) ? body.items : [{ id: body.id, status: body.status }];
  const valid = new Set(['pending', 'approved', 'rejected']);
  const reviewedAt = new Date().toISOString();
  let updated = 0;

  for (const item of items) {
    const id = Number(item.id);
    const status = String(item.status || '').trim();
    if (!Number.isInteger(id) || id <= 0 || !valid.has(status)) continue;
    await env.DB.prepare(`UPDATE notes SET status = ?, reviewed_at = ? WHERE id = ?`)
      .bind(status, reviewedAt, id)
      .run();
    updated++;
  }
  return json({ ok: true, updated });
}

export async function onRequestDelete({ request, env }) {
  if (!checkAuth(request, env)) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  if (!env.DB) return json({ ok: false, error: 'DB_NOT_BOUND' }, 503);
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_ID' }, 400);
  await env.DB.prepare(`DELETE FROM notes WHERE id = ?`).bind(id).run();
  return json({ ok: true, deleted: id });
}
