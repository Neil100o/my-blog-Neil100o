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

      // 发邮件提醒（失败不影响评论提交）
      if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
        try {
          await fetch('https://api.resend.com/emails', {
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
        } catch (mailErr) {
          console.error('Mail send failed:', mailErr);
        }
      }

      return Response.json({ success: true });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}