// api/submissions/[id].js
// Vercel Serverless Function — handles single-record operations
// Handles: DELETE /api/submissions/:id → delete record

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Admin auth
  const adminSecret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: '未授权，请检查管理员密钥' });
  }

  const { id } = req.query;
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ error: '无效的稿件 ID' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const rows = await sql(
      `DELETE FROM submissions WHERE id = $1 RETURNING id`,
      [parseInt(id, 10)]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '稿件不存在' });
    }
    return res.status(200).json({ deleted: true, id: rows[0].id });
  } catch (err) {
    console.error('[DELETE /api/submissions/:id]', err);
    return res.status(500).json({ error: '数据库删除失败', detail: err.message });
  }
}
