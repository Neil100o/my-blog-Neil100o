// 生成随机秘钥
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
    
    // 可选：验证解谜答案（如果提供了答案）
    if (body.answers) {
      // 这里可以验证 ARG 答案，暂时跳过，前端验证即可
    }
    
    // 生成秘钥
    const key = generateKey();
    const now = Date.now();
    
    // 写入 KV，7 天过期（用 KV 的 expiration_ttl）
    await env.SECRET_KV.put(key, JSON.stringify({
      created: now,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown'
    }), { expirationTtl: 604800 }); // 7 天 = 604800 秒
    
    return Response.json({ success: true, key: key });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
