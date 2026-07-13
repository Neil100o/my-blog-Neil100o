export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { filename, content, password } = await request.json();
    
    if (!env.ADMIN_PASSWORD) {
      return Response.json({ error: '管理员密码未配置' }, { status: 500 });
    }

    if (password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: '管理员密码错误' }, { status: 403 });
    }
    
    if (!filename || !content) {
      return Response.json({ error: '缺少文件名或内容' }, { status: 400 });
    }
    
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const ext = filename.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      return Response.json({ error: '仅支持图片格式: ' + allowed.join(', ') }, { status: 400 });
    }
    
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = dateStr + '-' + random + '.' + ext;
    const path = 'blog/' + safeName;
    
    const githubRes = await fetch(
      `https://api.github.com/repos/Neil100o/bolg_images_mo/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Pages-Blog'
        },
        body: JSON.stringify({
          message: `upload: ${safeName}`,
          content: content,
          branch: 'main'
        })
      }
    );
    
    if (!githubRes.ok) {
      const err = await githubRes.json();
      return Response.json({ error: err.message || 'GitHub 上传失败' }, { status: 500 });
    }
    
    return Response.json({
      success: true,
      url: `https://cdn.jsdelivr.net/gh/Neil100o/bolg_images_mo@main/${path}`,
      name: safeName
    });
    
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
