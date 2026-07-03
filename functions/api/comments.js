export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.searchParams.get('path');

    if (!path) return new Response('Missing path', { status: 400 });

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

      // 调试日志
      let notify_log = [];

      // 通知被回复的人
      if (body.parent_id && env.RESEND_API_KEY) {
        try {
          const { results: parentResults } = await env.DB.prepare(
            'SELECT author, email, content FROM comments WHERE id = ?'
          ).bind(body.parent_id).all();
          const parent = parentResults && parentResults[0];
          notify_log.push('parent found: ' + (parent ? 'yes' : 'no'));
          if (parent) {
            notify_log.push('parent email: ' + parent.email);
            notify_log.push('same email: ' + (parent.email === body.email));
          }
          if (parent && parent.email && parent.email !== body.email) {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + env.RESEND_API_KEY
              },
              body: JSON.stringify({
                from: 'onboarding@resend.dev',
                to: [parent.email],
                subject: body.author + ' 回复了你在 ' + path + ' 的评论',
                html: '<p><strong>' + body.author + '</strong> 回复了你的评论：</p>' +
                      '<p style="background:#f5f5f5;padding:1rem;">' + body.content + '</p>' +
                      '<p>你的原评论：</p>' +
                      '<p style="background:#f5f5f5;padding:1rem;color:#666;">' + parent.content + '</p>' +
                      '<p><a href="' + (url.origin + path) + '" style="color:#cc0000;">→ 查看文章</a></p>'
              })
            });
            notify_log.push('resend status: ' + res.status);
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              notify_log.push('resend error: ' + JSON.stringify(err));
            } else {
              notify_log.push('resend sent ok');
            }
          }
        } catch (replyMailErr) {
          notify_log.push('replyMailErr: ' + replyMailErr.message);
        }
      } else {
        notify_log.push('no reply notify: parent_id=' + body.parent_id + ', resend_key=' + (env.RESEND_API_KEY ? 'yes' : 'no'));
      }

      // 发邮件提醒管理员
      if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + env.RESEND_API_KEY
            },
            body: JSON.stringify({
              from: 'onboarding@resend.dev',
              to: [env.NOTIFY_EMAIL],
              subject: '新评论: ' + path,
              html: '<p><strong>作者:</strong> ' + body.author + ' &lt;' + body.email + '&gt;</p>' +
                    '<p><strong>文章:</strong> ' + path + '</p>' +
                    (body.parent_id ? '<p><strong>类型:</strong> 回复</p>' : '<p><strong>类型:</strong> 评论</p>') +
                    '<p><strong>内容:</strong></p><pre style="background:#f5f5f5;padding:1rem;">' + body.content + '</pre>'
            })
          });
          notify_log.push('admin notify status: ' + res.status);
        } catch (mailErr) {
          notify_log.push('adminMailErr: ' + mailErr.message);
        }
      }

      return Response.json({ success: true, notify_log });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
