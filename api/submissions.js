// api/submissions.js
// Vercel Serverless Function — connects to Neon via @neondatabase/serverless
// Handles: GET /api/submissions  → list/filter
//          POST /api/submissions → insert new record

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  // CORS headers (adjust origin in production if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Connect to Neon using the connection string from environment variable
  const sql = neon(process.env.DATABASE_URL);
  const VALID_TYPES = ['寻物启事', '表白', '挂人', '扩列', '吐槽', '交易', '捞人、物', '打听资讯', '寻找搭子'];

  // ── GET: fetch all submissions with optional filters ──
  if (req.method === 'GET') {
    const { type, start, end, order = 'desc', limit = '200' } = req.query;

    // Build dynamic WHERE clause
    const conditions = [];
    const params = [];

    if (type) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (start) {
      params.push(start);
      conditions.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (end) {
      // end of that day
      params.push(end + ' 23:59:59');
      conditions.push(`created_at <= $${params.length}::timestamptz`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    params.push(parseInt(limit, 10) || 200);

    const query = `
      SELECT id, created_at, content, type
      FROM submissions
      ${where}
      ORDER BY created_at ${sortDir}
      LIMIT $${params.length}
    `;

    try {
      const rows = await sql(query, params);
      return res.status(200).json({ data: rows });
    } catch (err) {
      console.error('[GET /api/submissions]', err);
      return res.status(500).json({ error: '数据库查询失败', detail: err.message });
    }
  }

  // ── POST: insert a new submission ──
  if (req.method === 'POST') {
    // Simple admin auth via secret header (set ADMIN_SECRET in Vercel env vars)
    const adminSecret = req.headers['x-admin-secret'];
    if (process.env.ADMIN_SECRET && adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: '未授权，请检查管理员密钥' });
    }

    const { created_at, content, type } = req.body;

    // Validate
    if (!created_at || !content || !type) {
      return res.status(400).json({ error: '缺少必填字段：created_at、content、type' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `无效的投稿类型：${type}` });
    }

    if (content.length < 5 || content.length > 2000) {
      return res.status(400).json({ error: '稿件内容长度须在 5~2000 字之间' });
    }

    try {
      const rows = await sql(
        `INSERT INTO submissions (created_at, content, type)
         VALUES ($1::timestamptz, $2, $3)
         RETURNING id, created_at, content, type`,
        [created_at, content.trim(), type]
      );
      return res.status(201).json({ data: rows[0] });
    } catch (err) {
      console.error('[POST /api/submissions]', err);
      return res.status(500).json({ error: '数据库写入失败', detail: err.message });
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
