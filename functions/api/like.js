import { hasValidSecretSession, jsonNoStore } from '../_shared/secret-auth.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.searchParams.get('path');

    if (!path) return new Response('Missing path', { status: 400 });
    if (path.toLowerCase().startsWith('/whispers') && !(await hasValidSecretSession(request, env))) {
      return jsonNoStore({ error: 'Unauthorized' }, 401);
    }
    if (!env.DB) return Response.json({ error: 'DB not bound' }, { status: 500 });

    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT count FROM likes WHERE path = ?'
      ).bind(path).all();
      return Response.json({ count: results[0]?.count || 0 });
    }

    if (request.method === 'POST') {
      await env.DB.prepare(
        `INSERT INTO likes (path, count) VALUES (?, 1)
         ON CONFLICT(path) DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP`
      ).bind(path).run();
      const { results } = await env.DB.prepare(
        'SELECT count FROM likes WHERE path = ?'
      ).bind(path).all();
      return Response.json({ count: results[0].count });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
