import type { Repo } from '../types.js';
import { fresh } from '../utils/freshness.js';
import { getGithubToken } from '../utils/config.js';

const BASE = 'https://api.github.com';

function headers(): Record<string, string> {
  const token = getGithubToken();
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function searchRepos(query: string, limit = 10): Promise<Repo[]> {
  const url = `${BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json() as { items: any[] };
  return data.items.map(r => ({
    ...fresh('github'),
    name: r.name,
    full_name: r.full_name,
    description: r.description ?? undefined,
    url: r.html_url,
    stars: r.stargazers_count,
    forks: r.forks_count,
    language: r.language ?? undefined,
    updated_at: r.updated_at,
    topics: r.topics ?? [],
  }));
}

export async function getTrendingRepos(language?: string, limit = 10): Promise<Repo[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const q = `created:>${since}${language ? ` language:${language}` : ''}`;
  return searchRepos(q + ' stars:>10', limit);
}
