export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!path) return new Response('Missing path', { status: 400 });

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM comments WHERE path = ? ORDER BY created_at DESC'
    ).bind(path).all();
    return Response.json(results);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    if (!body.author || !body.content) {
      return new Response('Missing fields', { status: 400 });
    }
    await env.DB.prepare(
      'INSERT INTO comments (path, author, content) VALUES (?, ?, ?)'
    ).bind(path, body.author.slice(0, 50), body.content.slice(0, 1000)).run();
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}