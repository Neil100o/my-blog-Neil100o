export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (!env.DB) {
      return Response.json({ error: 'DB not bound' }, { status: 500 });
    }

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const password = url.searchParams.get('password');
      if (password !== env.ADMIN_PASSWORD) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { results } = await env.DB.prepare(
        'SELECT id, path, author, email, content, parent_id, created_at FROM comments ORDER BY created_at DESC'
      ).all();
      return Response.json(results || []);
    }

    if (request.method === 'DELETE') {
      const body = await request.json();
      if (body.password !== env.ADMIN_PASSWORD) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!body.id) {
        return Response.json({ error: 'Missing id' }, { status: 400 });
      }
      await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(body.id).run();
      return Response.json({ success: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
