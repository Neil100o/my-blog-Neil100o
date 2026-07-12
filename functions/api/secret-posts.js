export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return Response.json({ error: 'Missing key' }, { status: 400 });
    }
    
    if (!env.SECRET_KV) {
      return Response.json({ error: 'KV not bound' }, { status: 500 });
    }
    
    // 验证秘钥
    const keyData = await env.SECRET_KV.get(key);
    if (!keyData) {
      return Response.json({ error: 'Invalid key' }, { status: 403 });
    }
    
    // 从 GitHub API 读取 hidden 目录下的文章列表
    // 需要 GITHUB_TOKEN 来访问私有内容，或者仓库是公开的
    const githubToken = env.GITHUB_TOKEN || '';
    const repo = 'Neil100o/my-blog-Neil100o';
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'blog-secret-api'
    };
    if (githubToken) {
      headers['Authorization'] = 'token ' + githubToken;
    }
    
    const ghRes = await fetch(
      'https://api.github.com/repos/' + repo + '/contents/src/content/hidden',
      { headers }
    );
    
    if (!ghRes.ok) {
      return Response.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }
    
    const files = await ghRes.json();
    if (!Array.isArray(files)) {
      return Response.json({ posts: [] });
    }
    
    // 解析每篇文章的 frontmatter（需要下载文件内容）
    // 为了性能，这里只返回文件名列表，前端或另一个 API 获取详情
    const posts = [];
    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.md')) {
        const id = file.name.replace('.md', '');
        // 尝试获取 frontmatter
        try {
          const contentRes = await fetch(file.download_url);
          const content = await contentRes.text();
          // 简单解析 frontmatter
          const fm = {};
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const lines = fmMatch[1].split('\n');
            for (const line of lines) {
              const colonIdx = line.indexOf(':');
              if (colonIdx > 0) {
                const k = line.slice(0, colonIdx).trim();
                let v = line.slice(colonIdx + 1).trim();
                // 去掉引号
                if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                  v = v.slice(1, -1);
                }
                fm[k] = v;
              }
            }
          }
          posts.push({
            id: id,
            title: fm.title || id,
            pubDate: fm.pubDate || '',
            heroImage: fm.heroImage || '',
            description: fm.description || '',
            tags: fm.tags ? fm.tags.split(',').map(function(t) { return t.trim(); }) : []
          });
        } catch (e) {
          posts.push({ id: id, title: id });
        }
      }
    }
    
    // 按日期排序
    posts.sort(function(a, b) {
      return new Date(b.pubDate || 0).valueOf() - new Date(a.pubDate || 0).valueOf();
    });
    
    return Response.json({ posts });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
