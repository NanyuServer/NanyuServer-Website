const { neon } = require('@neondatabase/serverless');
const { validateAdminSecret } = require('./adminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = neon(process.env.DATABASE_URL);
  await sql(`
    CREATE TABLE IF NOT EXISTS recruit_positions (
      id serial PRIMARY KEY,
      title varchar(120) NOT NULL,
      description text NOT NULL,
      tags text DEFAULT '',
      apply_url text DEFAULT '',
      created_at timestamptz DEFAULT NOW()
    )
  `);

  if (req.method === 'GET') {
    try {
      const rows = await sql(
        `SELECT id, title, description, tags, apply_url, created_at
         FROM recruit_positions
         ORDER BY created_at DESC`
      );
      return res.status(200).json({ data: rows });
    } catch (err) {
      console.error('[GET /api/recruitments]', err);
      return res.status(500).json({ error: '数据库查询失败', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    const adminSecret = req.headers['x-admin-secret'];
    if (!(await validateAdminSecret(adminSecret))) {
      return res.status(401).json({ error: '未授权，请检查管理员密钥' });
    }

    const { title, description, tags = '', apply_url = '' } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ error: '缺少必填字段：title、description' });
    }
    if (title.length > 120) {
      return res.status(400).json({ error: '职位标题不能超过120个字符' });
    }
    if (description.length > 1200) {
      return res.status(400).json({ error: '职位描述不能超过1200个字符' });
    }

    try {
      const rows = await sql(
        `INSERT INTO recruit_positions (title, description, tags, apply_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, description, tags, apply_url, created_at`,
        [title.trim(), description.trim(), String(tags).trim(), String(apply_url).trim()]
      );
      return res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error('[POST /api/recruitments]', err);
      return res.status(500).json({ error: '数据库写入失败', detail: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
