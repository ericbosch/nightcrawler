import type { LandscapeReport, Repo } from '../types.js';
import { searchRepos, getTrendingRepos } from '../adapters/github.js';
import { searchHN } from '../adapters/hackernews.js';
import { searchArxiv } from '../adapters/arxiv.js';
import { fresh } from '../utils/freshness.js';

export async function getLandscape(topic: string): Promise<LandscapeReport> {
  const [repos, hn_stories, arxiv_papers] = await Promise.all([
    searchRepos(topic, 8).catch(() => [] as Repo[]),
    searchHN(topic, 8).catch(() => []),
    searchArxiv(topic, 4).catch(() => []),
  ]);
  return { ...fresh('landscape'), topic, repos, hn_stories, arxiv_papers };
}

export async function searchReposTool(query: string): Promise<Repo[]> {
  return searchRepos(query, 10);
}
