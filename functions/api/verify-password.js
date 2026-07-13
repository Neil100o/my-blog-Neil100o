export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    const body = await request.json();
    if (!body.password) {
      return Response.json({ error: 'Missing password' }, { status: 400 });
    }
    if (!env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Admin password not configured' }, { status: 500 });
    }
    if (body.password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
