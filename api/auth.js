const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

// Initialization function
async function ensureDefaultAdmin(sql) {
  try {
    // Create table if not exists
    await sql(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id serial PRIMARY KEY,
        username varchar(50) UNIQUE NOT NULL,
        password_hash varchar(255) NOT NULL,
        secret_key varchar(100) UNIQUE NOT NULL,
        created_at timestamptz DEFAULT NOW(),
        last_login timestamptz DEFAULT NULL
      )
    `);

    // Check if default admin exists
    const existing = await sql(`SELECT COUNT(*) as cnt FROM admin_users WHERE username = $1`, ['admin']);
    const count = existing[0]?.cnt || 0;
    
    if (count === 0) {
      const defaultPass = 'nywll2026';
      const passwordHash = crypto.createHash('sha256').update(defaultPass).digest('hex');
      const secretKey = crypto.randomBytes(32).toString('hex');
      
      await sql(
        `INSERT INTO admin_users (username, password_hash, secret_key) VALUES ($1, $2, $3)`,
        ['admin', passwordHash, secretKey]
      );
      console.log('[AUTH] ✓ Default admin user created (admin / nywll2026)');
      return { initialized: true, message: '默认管理员已创建' };
    }
    return { initialized: true, message: '管理员账户已存在' };
  } catch (err) {
    console.error('[AUTH] Error initializing admin:', err);
    throw err;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = neon(process.env.DATABASE_URL);
  
  // Ensure default admin on every request
  try {
    await ensureDefaultAdmin(sql);
  } catch (err) {
    console.error('[AUTH] Initialization error:', err);
  }

  if (req.method === 'GET') {
    try {
      const initResult = await ensureDefaultAdmin(sql);
      return res.status(200).json({
        status: 'ready',
        message: initResult.message,
        hint: '默认账号: admin | 密码: nywll2026'
      });
    } catch (err) {
      return res.status(500).json({ error: '初始化失败', detail: err.message });
    }
  }

  if (req.method === 'POST') {
    const action = req.headers['x-action'] || 'login';

    if (action === 'login') {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: '缺少用户名或密码' });
      }

      try {
        const users = await sql(
          `SELECT id, username, password_hash, secret_key FROM admin_users WHERE username = $1`,
          [username]
        );

        if (users.length === 0) {
          return res.status(401).json({ error: '用户名或密码错误' });
        }

        const user = users[0];
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

        if (passwordHash !== user.password_hash) {
          return res.status(401).json({ error: '用户名或密码错误' });
        }

        // Update last_login
        await sql(`UPDATE admin_users SET last_login = NOW() WHERE id = $1`, [user.id]);

        // Return token (using secret_key as session token)
        return res.status(200).json({
          success: true,
          token: user.secret_key,
          username: user.username
        });
      } catch (err) {
        console.error('[AUTH POST login]', err);
        return res.status(500).json({ error: '认证失败', detail: err.message });
      }
    }

    if (action === 'verify') {
      const token = req.headers['x-admin-secret'];
      if (!token) {
        return res.status(401).json({ error: '缺少认证令牌' });
      }

      try {
        const users = await sql(
          `SELECT id, username, secret_key FROM admin_users WHERE secret_key = $1`,
          [token]
        );

        if (users.length === 0) {
          return res.status(401).json({ error: '令牌无效' });
        }

        return res.status(200).json({
          valid: true,
          username: users[0].username
        });
      } catch (err) {
        console.error('[AUTH POST verify]', err);
        return res.status(500).json({ error: '验证失败', detail: err.message });
      }
    }

    if (action === 'change-password') {
      const { username, old_password, new_password } = req.body || {};
      if (!username || !old_password || !new_password) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: '新密码至少6个字符' });
      }

      try {
        const users = await sql(
          `SELECT id, password_hash FROM admin_users WHERE username = $1`,
          [username]
        );

        if (users.length === 0) {
          return res.status(404).json({ error: '用户不存在' });
        }

        const user = users[0];
        const oldPassHash = crypto.createHash('sha256').update(old_password).digest('hex');

        if (oldPassHash !== user.password_hash) {
          return res.status(401).json({ error: '旧密码不正确' });
        }

        const newPassHash = crypto.createHash('sha256').update(new_password).digest('hex');
        await sql(
          `UPDATE admin_users SET password_hash = $1 WHERE id = $2`,
          [newPassHash, user.id]
        );

        return res.status(200).json({ success: true, message: '密码已更新' });
      } catch (err) {
        console.error('[AUTH POST change-password]', err);
        return res.status(500).json({ error: '更新失败', detail: err.message });
      }
    }
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed` });
};
