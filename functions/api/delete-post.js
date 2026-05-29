export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    const payload = await request.json();
    const { slug, folder, password } = payload;
    
    // 密码验证
    if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: '密码错误' }, { status: 403 });
    }
    
    if (!slug) {
      return Response.json({ error: 'slug 不能为空' }, { status: 400 });
    }
    
    // 确定目录：默认 blog，也可以是 hidden
    const targetFolder = folder || 'blog';
    const path = `src/content/${targetFolder}/${slug}`;
    
    // 先获取文件 SHA（GitHub 删除需要 SHA）
    const getRes = await fetch(
      `https://api.github.com/repos/Neil100o/my-blog-Neil100o/contents/${path}?ref=main`,
      {
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Pages-Blog'
        }
      }
    );
    
    if (!getRes.ok) {
      const err = await getRes.json();
      return Response.json({ error: err.message || '获取文件信息失败' }, { status: 500 });
    }
    
    const fileData = await getRes.json();
    const sha = fileData.sha;
    
    // 删除文件
    const deleteRes = await fetch(
      `https://api.github.com/repos/Neil100o/my-blog-Neil100o/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Pages-Blog'
        },
        body: JSON.stringify({
          message: `delete ${targetFolder} post: ${slug}`,
          sha: sha,
          branch: 'main'
        })
      }
    );
    
    if (!deleteRes.ok) {
      const err = await deleteRes.json();
      return Response.json({ error: err.message || '删除失败' }, { status: 500 });
    }
    
    return Response.json({ success: true, path, folder: targetFolder });
    
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}