export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return Response.json({ valid: false, error: 'Missing key' }, { status: 400 });
    }
    
    if (!env.SECRET_KV) {
      return Response.json({ error: 'KV not bound' }, { status: 500 });
    }
    
    const data = await env.SECRET_KV.get(key);
    if (!data) {
      return Response.json({ valid: false });
    }
    
    return Response.json({ valid: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
