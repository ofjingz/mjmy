/**
 * 留言板管理员上传 Excel 导出的 CSV 批量同步审核状态
 * POST /api/admin/import  (body: text/csv)
 * 识别 id 列 + 审核状态列（支持：通过/approved/1/是 -> approved；不通过/拒绝/rejected/0/否 -> rejected；其余 -> pending）
 */

import { isAdminPasswordValid } from '../../_admin-auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\r') { /* ignore */ }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function normalizeStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (['通过', '已通过', 'approved', 'approve', 'yes', 'y', '1', 'true', 'ok'].includes(s)) return 'approved';
  if (['不通过', '拒绝', 'rejected', 'reject', 'no', 'n', '0', 'false'].includes(s)) return 'rejected';
  return 'pending';
}

export async function onRequestPost({ request, env }) {
  if (!isAdminPasswordValid(request.headers.get('x-admin-key'), env)) {
    return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }
  if (!env.DB) return json({ ok: false, error: 'DB_NOT_BOUND' }, 503);

  const csvText = await request.text();
  const rows = parseCSV(csvText);
  if (rows.length < 2) return json({ ok: false, error: 'EMPTY_CSV' }, 400);

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idIdx = headers.findIndex((h) => h === 'id');
  const statusIdx = headers.findIndex((h) => h.includes('审核') || h.includes('status'));
  if (idIdx === -1 || statusIdx === -1) {
    return json({ ok: false, error: 'MISSING_COLUMNS', hint: '需要包含 id 列和 审核状态 列' }, 400);
  }

  const reviewedAt = new Date().toISOString();
  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = Number(r[idIdx]);
    if (!Number.isInteger(id) || id <= 0) continue;
    const status = normalizeStatus(r[statusIdx]);
    await env.DB.prepare(`UPDATE notes SET status = ?, reviewed_at = ? WHERE id = ?`)
      .bind(status, reviewedAt, id)
      .run();
    updated++;
  }

  return json({ ok: true, updated });
}
