import { hasValidSecretSession, jsonNoStore } from '../_shared/secret-auth.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (!env.SECRET_KV) {
      return jsonNoStore({ valid: false, error: 'Secret storage unavailable' }, 500);
    }

    const valid = await hasValidSecretSession(request, env);
    return jsonNoStore({ valid }, valid ? 200 : 401);
  } catch (e) {
    return jsonNoStore({ valid: false, error: 'Session check failed' }, 500);
  }
}
