import {
  SESSION_TTL,
  generateSessionToken,
  jsonNoStore,
  sessionCookie,
  timingSafePasswordMatch
} from '../_shared/secret-auth.js';

const ATTEMPT_WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 8;

export async function onRequest(context) {
  try {
    const { request, env } = context;
    
    if (request.method !== 'POST') {
      return jsonNoStore({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
    }
    
    if (!env.SECRET_KV) {
      return jsonNoStore({ error: 'Secret storage unavailable' }, 500);
    }
    
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || password.length > 256) {
      return jsonNoStore({ error: 'Invalid password' }, 401);
    }
    
    // 从环境变量读取秘钥，必须设置 SECRET_PASSWORD
    if (!env.SECRET_PASSWORD) {
      return jsonNoStore({ error: 'Secret password not configured' }, 500);
    }

    const ip = request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown';
    const attemptKey = 'attempt:' + ip;
    const attempts = Number(await env.SECRET_KV.get(attemptKey)) || 0;
    if (attempts >= MAX_ATTEMPTS) {
      return jsonNoStore({ error: 'Too many attempts' }, 429, { 'Retry-After': String(ATTEMPT_WINDOW_SECONDS) });
    }

    if (!(await timingSafePasswordMatch(password, env.SECRET_PASSWORD))) {
      await env.SECRET_KV.put(attemptKey, String(attempts + 1), {
        expirationTtl: ATTEMPT_WINDOW_SECONDS
      });
      return jsonNoStore({ error: 'Invalid password' }, 401);
    }

    await env.SECRET_KV.delete(attemptKey);
    const token = generateSessionToken();
    const now = Date.now();

    await env.SECRET_KV.put('session:' + token, JSON.stringify({
      created: now,
      ip
    }), { expirationTtl: SESSION_TTL });

    return jsonNoStore({ success: true }, 200, {
      'Set-Cookie': sessionCookie(token)
    });
  } catch (e) {
    return jsonNoStore({ error: 'Unlock failed' }, 500);
  }
}
