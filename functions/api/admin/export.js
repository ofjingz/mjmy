/**
 * 留言板管理员一键导出 Excel 兼容 CSV（带 UTF-8 BOM，Mac/Win Excel 直接打开不乱码）
 * GET /api/admin/export
 */

import { isAdminPasswordValid } from '../../_admin-auth.js';

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const STATUS_ZH = { pending: '待审核', approved: '通过', rejected: '不通过' };

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const got = request.headers.get('x-admin-key') || url.searchParams.get('key') || '';
  if (!isAdminPasswordValid(got, env)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.DB) return new Response('DB_NOT_BOUND', { status: 503 });

  const { results } = await env.DB.prepare(
    `SELECT id, nickname, favorite_movie, content, status, created_at, reviewed_at
     FROM notes
     ORDER BY id DESC`
  ).all();

  const header = ['id', '昵称', '最爱的一部电影', '留言内容', '审核状态(通过/待审核/不通过)', '提交时间', '审核时间'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of results || []) {
    lines.push([
      row.id,
      row.nickname,
      row.favorite_movie || '',
      row.content,
      STATUS_ZH[row.status] || row.status,
      row.created_at,
      row.reviewed_at || '',
    ].map(csvCell).join(','));
  }

  const bom = '\uFEFF';
  const today = new Date().toISOString().slice(0, 10);
  return new Response(bom + lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mujian-notes-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
