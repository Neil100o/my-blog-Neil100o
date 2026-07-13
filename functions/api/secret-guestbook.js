import { hasValidSecretSession, jsonNoStore } from '../_shared/secret-auth.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== 'POST') {
      return jsonNoStore({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
    }
    if (!(await hasValidSecretSession(request, env))) {
      return jsonNoStore({ error: 'Unauthorized' }, 401);
    }
    if (!env.DB) {
      return jsonNoStore({ error: 'Guestbook unavailable' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const alias = typeof body.alias === 'string' ? body.alias.trim() : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
    if (!alias || alias.length > 50 || contact.length > 200) {
      return jsonNoStore({ error: 'Invalid guest information' }, 400);
    }

    await ensureGuestTable(env.DB);
    await env.DB.prepare(
      'INSERT INTO secret_guests (alias, contact) VALUES (?, ?)'
    ).bind(
      alias,
      contact || null
    ).run();

    return jsonNoStore({ success: true });
  } catch (e) {
    return jsonNoStore({ error: 'Failed to save guest information' }, 500);
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
