// api/submissions/[id].js
// Vercel Serverless Function — handles single-record operations
// Handles: DELETE /api/submissions/:id → delete record

const { neon } = require('@neondatabase/serverless');

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body !== 'string') {
      return resolve(req.body);
    }

    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sql = neon(process.env.DATABASE_URL);
    const VALID_TYPES = ['寻物启事', '表白', '挂人', '扩列', '吐槽', '交易', '捞人、物', '打听资讯', '寻找搭子'];

    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id || isNaN(parseInt(id, 10))) {
        return res.status(400).json({ error: '无效的稿件 ID' });
      }

      const body = await parseJsonBody(req);
      const { content, type } = body || {};
      if (!content && !type) {
        return res.status(400).json({ error: '必须提供要更新的字段' });
      }
      if (type && !VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `无效的投稿类型：${type}` });
      }

      const fields = [];
      const params = [];
      if (content) {
        params.push(content.trim());
        fields.push(`content = $${params.length}`);
      }
      if (type) {
        params.push(type);
        fields.push(`type = $${params.length}`);
      }
      params.push(parseInt(id, 10));

      try {
        const rows = await sql(
          `UPDATE submissions SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, created_at, content, type`,
          params
        );
        if (rows.length === 0) {
          return res.status(404).json({ error: '稿件不存在' });
        }
        return res.status(200).json({ data: rows[0] });
      } catch (err) {
        console.error('[PATCH /api/submissions/:id]', err);
        return res.status(500).json({ error: '数据库更新失败', detail: err.message });
      }
    }

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
  } catch (err) {
    console.error('[api/submissions/[id]] unexpected error]', err);
    return res.status(500).json({ error: '服务器内部错误', detail: err.message });
  }
};
