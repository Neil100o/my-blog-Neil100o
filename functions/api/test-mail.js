export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    if (!env.RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY not set' }, { status: 500 });
    }
    
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [body.to || env.NOTIFY_EMAIL],
        subject: '测试邮件',
        html: '<p>这是一封测试邮件</p>'
      })
    });
    
    const data = await res.json().catch(() => ({}));
    
    return Response.json({
      status: res.status,
      ok: res.ok,
      data: data
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
