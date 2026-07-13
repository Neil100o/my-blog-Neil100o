import { hasValidSecretSession, jsonNoStore } from '../_shared/secret-auth.js';

const REPOSITORY = 'Neil100o/my-blog-Neil100o';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== 'GET') {
      return jsonNoStore({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
    }
    if (!(await hasValidSecretSession(request, env))) {
      return jsonNoStore({ error: 'Unauthorized' }, 401);
    }

    const slug = new URL(request.url).searchParams.get('slug') || '';
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(slug)) {
      return jsonNoStore({ error: 'Invalid article' }, 400);
    }

    const headers = {
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'blog-secret-api'
    };
    if (env.GITHUB_TOKEN) headers.Authorization = 'token ' + env.GITHUB_TOKEN;

    const githubResponse = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/contents/src/content/hidden/${encodeURIComponent(slug)}.md`,
      { headers }
    );
    if (githubResponse.status === 404) {
      return jsonNoStore({ error: 'Article not found' }, 404);
    }
    if (!githubResponse.ok) {
      return jsonNoStore({ error: 'Failed to fetch article' }, 502);
    }

    const source = await githubResponse.text();
    const { frontmatter, markdown } = parseMarkdownFile(source);
    return jsonNoStore({
      post: {
        id: slug,
        title: frontmatter.title || slug,
        description: frontmatter.description || '',
        pubDate: frontmatter.pubDate || '',
        heroImage: frontmatter.heroImage || '',
        tags: parseTags(frontmatter.tags),
        markdown
      }
    });
  } catch (e) {
    return jsonNoStore({ error: 'Failed to load article' }, 500);
  }
}

function parseMarkdownFile(source) {
  const normalized = source.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: {}, markdown: normalized };

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }
  return { frontmatter, markdown: normalized.slice(match[0].length) };
}

function parseTags(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) {}
  return value.split(',').map(tag => tag.trim()).filter(Boolean);
}
