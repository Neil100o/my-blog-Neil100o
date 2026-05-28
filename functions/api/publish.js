export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { title, slug, date, tags, content, password } = await request.json();
    
    // 密码验证
    if (!env.ADMIN_PASSWORD) {
      return Response.json({ error: '服务器未配置密码' }, { status: 500 });
    }
    if (password !== env.ADMIN_PASSWORD) {
      return Response.json({ error: '密码错误' }, { status: 403 });
    }
    
    if (!title || !content || !date) {
      return Response.json({ error: '标题、内容和日期不能为空' }, { status: 400 });
    }
    
    const filename = slug.endsWith('.md') ? slug : `${slug}.md`;
    const path = `src/content/blog/${filename}`;
    
    const tagStr = tags && tags.length 
      ? `\ntags: [${tags.map(t => `"${t}"`).join(', ')}]` 
      : '';

    const heroImageStr = body.heroImage ? `\nheroImage: "${body.heroImage}"` : '';
    
    const fileContent = `---
title: "${title}"
pubDate: ${date}
description: "${title}"${tagStr}${heroImageStr}
---

${content}
`;
    
    const bytes = new TextEncoder().encode(fileContent);
    const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
    const encoded = btoa(binary);
    
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
          message: `add post: ${title}`,
          content: encoded,
          branch: 'main'
        })
      }
    );
    
    if (!githubRes.ok) {
      const err = await githubRes.json();
      if (err.message?.includes('already exists')) {
        return Response.json({ error: '该 slug 已存在，请换一个' }, { status: 409 });
      }
      return Response.json({ error: err.message || 'GitHub API 错误' }, { status: 500 });
    }
    
    const data = await githubRes.json();
    return Response.json({ success: true, path, sha: data.content.sha });
    
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}