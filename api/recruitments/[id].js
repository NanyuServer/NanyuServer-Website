const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);
  const { id } = req.query;
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ error: '无效的岗位 ID' });
  }

  const adminSecret = req.headers['x-admin-secret'];
  if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: '未授权，请检查管理员密钥' });
  }

  if (req.method === 'DELETE') {
    try {
      const rows = await sql(
        `DELETE FROM recruit_positions WHERE id = $1 RETURNING id`,
        [parseInt(id, 10)]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: '岗位不存在' });
      }
      return res.status(200).json({ deleted: true, id: rows[0].id });
    } catch (err) {
      console.error('[DELETE /api/recruitments/:id]', err);
      return res.status(500).json({ error: '数据库删除失败', detail: err.message });
    }
  }

  if (req.method === 'PATCH') {
    const { title, description, tags, apply_url } = req.body || {};
    if (!title && !description && !tags && !apply_url) {
      return res.status(400).json({ error: '必须提供要更新的字段' });
    }

    const fields = [];
    const params = [];
    if (title) {
      params.push(title.trim());
      fields.push(`title = $${params.length}`);
    }
    if (description) {
      params.push(description.trim());
      fields.push(`description = $${params.length}`);
    }
    if (tags !== undefined) {
      params.push(String(tags).trim());
      fields.push(`tags = $${params.length}`);
    }
    if (apply_url !== undefined) {
      params.push(String(apply_url).trim());
      fields.push(`apply_url = $${params.length}`);
    }
    params.push(parseInt(id, 10));

    try {
      const rows = await sql(
        `UPDATE recruit_positions SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, title, description, tags, apply_url, created_at`,
        params
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: '岗位不存在' });
      }
      return res.status(200).json({ data: rows[0] });
    } catch (err) {
      console.error('[PATCH /api/recruitments/:id]', err);
      return res.status(500).json({ error: '数据库更新失败', detail: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
