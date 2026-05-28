export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { filename, content, password } = await request.json();
    
    // 密码验证（和发布文章共用同一个密码）
    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: '密码错误' }, { status: 403 });
    }
    
    if (!filename || !content) {
      return Response.json({ error: '缺少文件名或内容' }, { status: 400 });
    }
    
    // 只允许图片后缀
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const ext = filename.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      return Response.json({ error: '仅支持图片格式: ' + allowed.join(', ') }, { status: 400 });
    }
    
    // 生成唯一文件名: images/20260528-xxx.jpg
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = dateStr + '-' + random + '.' + ext;
    const path = 'public/images/' + safeName;
    
    // GitHub API 上传
    const githubRes = await fetch(
      `https://api.github.com/repos/Neil100o/my-blog-Neil100o/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Pages-Blog'
        },
        body: JSON.stringify({
          message: `upload image: ${safeName}`,
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
      url: '/images/' + safeName,
      name: safeName
    });
    
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}