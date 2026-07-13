export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (!env.DB) return Response.json({ error: 'DB not bound' }, { status: 500 });

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      await ensureGuestTable(env.DB);
      const { results } = await env.DB.prepare(
        'SELECT id, alias, contact, created_at FROM secret_guests ORDER BY created_at DESC LIMIT 500'
      ).all();
      (results || []).forEach(row => {
        if (row.created_at && !row.created_at.endsWith('Z')) row.created_at += 'Z';
      });
      return Response.json(results || []);
    }

    if (request.method === 'DELETE') {
      const body = await request.json().catch(() => ({}));
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!Number.isInteger(body.id)) {
        return Response.json({ error: 'Missing id' }, { status: 400 });
      }
      await ensureGuestTable(env.DB);
      await env.DB.prepare('DELETE FROM secret_guests WHERE id = ?').bind(body.id).run();
      return Response.json({ success: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: 'Guest list failed' }, { status: 500 });
  }
}

async function ensureGuestTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS secret_guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL,
      contact TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
