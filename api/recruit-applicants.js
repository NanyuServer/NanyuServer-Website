const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = neon(process.env.DATABASE_URL);
  await sql(`
    CREATE TABLE IF NOT EXISTS recruit_applicants (
      id serial PRIMARY KEY,
      name varchar(80) NOT NULL,
      qq varchar(64) NOT NULL,
      position_id integer NOT NULL,
      position_title varchar(120) NOT NULL,
      note text DEFAULT '',
      created_at timestamptz DEFAULT NOW()
    )
  `);

  if (req.method === 'GET') {
    const adminSecret = req.headers['x-admin-secret'];
    if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: '未授权，请检查管理员密钥' });
    }

    try {
      const rows = await sql(
        `SELECT id, created_at, name, qq, position_id, position_title, note
         FROM recruit_applicants
         ORDER BY created_at DESC`
      );
      return res.status(200).json({ data: rows });
    } catch (err) {
      console.error('[GET /api/recruit-applicants]', err);
      return res.status(500).json({ error: '数据库查询失败', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    const { name, qq, position_id, position_title, note = '' } = req.body || {};
    if (!name || !qq || !position_id || !position_title) {
      return res.status(400).json({ error: '缺少必填字段：name、qq、position_id、position_title' });
    }

    if (String(name).trim().length > 80) {
      return res.status(400).json({ error: '姓名不能超过80个字符' });
    }
    if (String(qq).trim().length > 64) {
      return res.status(400).json({ error: '联系方式不能超过64个字符' });
    }
    if (String(position_title).trim().length > 120) {
      return res.status(400).json({ error: '岗位名称不能超过120个字符' });
    }
    if (String(note).trim().length > 800) {
      return res.status(400).json({ error: '备注不能超过800个字符' });
    }

    try {
      const rows = await sql(
        `INSERT INTO recruit_applicants (name, qq, position_id, position_title, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, qq, position_id, position_title, note, created_at`,
        [String(name).trim(), String(qq).trim(), parseInt(position_id, 10), String(position_title).trim(), String(note).trim()]
      );
      return res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error('[POST /api/recruit-applicants]', err);
      return res.status(500).json({ error: '数据库写入失败', detail: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
