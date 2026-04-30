const { neon } = require('@neondatabase/serverless');

async function validateAdminSecret(adminSecret) {
  if (!adminSecret) return false;

  if (process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
    return true;
  }

  if (!process.env.DATABASE_URL) {
    return false;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql(
      `SELECT id FROM admin_users WHERE secret_key = $1 LIMIT 1`,
      [adminSecret]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.error('[adminAuth] validateAdminSecret error:', err);
    return false;
  }
}

module.exports = {
  validateAdminSecret
};
