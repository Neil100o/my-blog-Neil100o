// 生成随机访问 key
function generateKey() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function(b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    if (!env.SECRET_KV) {
      return Response.json({ error: 'KV not bound' }, { status: 500 });
    }
    
    const body = await request.json();
    const password = body.password || '';
    
    // 从环境变量读取秘钥，必须设置 SECRET_PASSWORD
    if (!env.SECRET_PASSWORD) {
      return Response.json({ error: 'SECRET_PASSWORD not configured' }, { status: 500 });
    }
    const CORRECT_PASSWORD = env.SECRET_PASSWORD;
    
    if (password !== CORRECT_PASSWORD) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }
    
    // 验证通过，生成访问 key
    const key = generateKey();
    const now = Date.now();
    
    await env.SECRET_KV.put(key, JSON.stringify({
      created: now,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown'
    }), { expirationTtl: 604800 }); // 7 天过期
    
    return Response.json({ success: true, key: key });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
