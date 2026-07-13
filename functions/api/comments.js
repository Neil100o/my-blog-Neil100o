import { hasValidSecretSession, jsonNoStore } from '../_shared/secret-auth.js';

async function getLocationFromIP(ip) {
  try {
    if (!ip || ip === 'unknown') return '';
    const res = await fetch('https://ipinfo.io/' + ip + '/json');
    if (!res.ok) return '';
    const data = await res.json();
    const parts = [];
    if (data.city) parts.push(data.city);
    if (data.region) parts.push(data.region);
    if (data.country) parts.push(data.country);
    return parts.join(', ');
  } catch (e) {
    return '';
  }
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.searchParams.get('path');

    if (!path) return new Response('Missing path', { status: 400 });

    if (path.toLowerCase().startsWith('/whispers') && !(await hasValidSecretSession(request, env))) {
      return jsonNoStore({ error: 'Unauthorized' }, 401);
    }

    if (!env.DB) {
      return Response.json({ error: 'DB not bound' }, { status: 500 });
    }

    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, path, author, email, content, parent_id, created_at FROM comments WHERE path = ? ORDER BY created_at ASC'
      ).bind(path).all();
      (results || []).forEach(r => {
        if (r.created_at && !r.created_at.endsWith('Z')) r.created_at += 'Z';
      });
      return Response.json(results || []);
    }

    if (request.method === 'POST') {
      const body = await request.json();
      if (!body.author || !body.email || !body.content) {
        return new Response('Missing fields', { status: 400 });
      }
      await env.DB.prepare(
        'INSERT INTO comments (path, author, email, content, parent_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        path, 
        body.author.slice(0, 50), 
        (body.email || '').slice(0, 100), 
        body.content.slice(0, 2000),
        body.parent_id || null
      ).run();

      // 通知被回复的人
      if (body.parent_id && env.RESEND_API_KEY) {
        try {
          const { results: parentResults } = await env.DB.prepare(
            'SELECT author, email, content FROM comments WHERE id = ?'
          ).bind(body.parent_id).all();
          const parent = parentResults && parentResults[0];
          if (parent && parent.email && parent.email !== body.email) {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + env.RESEND_API_KEY
              },
              body: JSON.stringify({
                from: 'noreply@em.moskavis.top',
                to: [parent.email],
                subject: body.author + ' 回复了你在 ' + path + ' 的评论',
                html: '<p><strong>' + body.author + '</strong> 回复了你的评论：</p>' +
                      '<p style="background:#f5f5f5;padding:1rem;">' + body.content + '</p>' +
                      '<p>你的原评论：</p>' +
                      '<p style="background:#f5f5f5;padding:1rem;color:#666;">' + parent.content + '</p>' +
                      '<p><a href="' + (url.origin + path) + '" style="color:#cc0000;">→ 查看文章</a></p>'
              })
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              console.error('Resend reply notification error:', res.status, err);
            }
          }
        } catch (replyMailErr) {
          console.error('Reply notification failed:', replyMailErr);
        }
      }

      // 发邮件提醒管理员（失败不影响评论提交）
      if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + env.RESEND_API_KEY
            },
            body: JSON.stringify({
              from: 'noreply@em.moskavis.top',
              to: [env.NOTIFY_EMAIL],
              subject: '新评论: ' + path,
              html: '<p><strong>作者:</strong> ' + body.author + ' &lt;' + body.email + '&gt;</p>' +
                    '<p><strong>文章:</strong> ' + path + '</p>' +
                    (body.parent_id ? '<p><strong>类型:</strong> 回复</p>' : '<p><strong>类型:</strong> 评论</p>') +
                    '<p><strong>内容:</strong></p><pre style="background:#f5f5f5;padding:1rem;">' + body.content + '</pre>'
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('Resend admin notification error:', res.status, err);
          }
        } catch (mailErr) {
          console.error('Mail send failed:', mailErr);
        }
      }

      // 记录评论者来源
      if (env.DB) {
        try {
          const commentIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                     'unknown';
          const commentLocation = await getLocationFromIP(commentIP);
          await env.DB.prepare(
            'INSERT INTO access_logs (ip, path, user_agent, referrer, country) VALUES (?, ?, ?, ?, ?)'
          ).bind(
            commentIP,
            path,
            request.headers.get('User-Agent') || '',
            request.headers.get('Referer') || '',
            commentLocation
          ).run();
        } catch (logErr) {
          console.error('Log comment source failed:', logErr);
        }
      }

      return Response.json({ success: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
