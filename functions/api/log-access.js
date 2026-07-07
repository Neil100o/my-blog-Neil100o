export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    if (request.method === 'POST') {
      if (!env.DB) {
        return Response.json({ error: 'DB not bound' }, { status: 500 });
      }
      const body = await request.json();
      const ip = request.headers.get('CF-Connecting-IP') || 
                 request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                 'unknown';
      const country = request.cf?.country || '';
      await env.DB.prepare(
        'INSERT INTO access_logs (ip, path, user_agent, referrer, country) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        ip,
        body.path || url.pathname,
        request.headers.get('User-Agent') || '',
        request.headers.get('Referer') || '',
        country
      ).run();
      return Response.json({ success: true });
    }

    if (request.method === 'GET') {
      const password = url.searchParams.get('password');
      if (password !== env.ADMIN_PASSWORD) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { results } = await env.DB.prepare(
        'SELECT id, ip, path, user_agent, referrer, country, created_at FROM access_logs ORDER BY created_at DESC LIMIT 500'
      ).all();
      (results || []).forEach(r => {
        if (r.created_at && !r.created_at.endsWith('Z')) r.created_at += 'Z';
      });
      return Response.json(results || []);
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
