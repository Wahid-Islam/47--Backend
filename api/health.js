/**
 * GET /api/health — plain CommonJS, zero local imports.
 * Used as the production liveness probe on Vercel.
 */
module.exports = async function health(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const payload = {
    status: 'ok',
    database: 'skipped',
    time: null,
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (typeof databaseUrl === 'string' && databaseUrl.trim() !== '') {
    try {
      const { neon } = require('@neondatabase/serverless');
      const url = databaseUrl
        .replace(/([?&])channel_binding=[^&]*&?/i, '$1')
        .replace(/[?&]$/, '');
      const sql = neon(url);
      const rows = await sql`SELECT now() AS now`;
      payload.database = 'ok';
      payload.time = rows[0] && rows[0].now != null ? rows[0].now : null;
    } catch (error) {
      console.error('health database check failed:', error && error.message ? error.message : error);
      payload.status = 'degraded';
      payload.database = 'unreachable';
      payload.error = 'database query failed';
    }
  } else {
    payload.status = 'degraded';
    payload.database = 'unreachable';
    payload.error = 'DATABASE_URL missing';
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};
