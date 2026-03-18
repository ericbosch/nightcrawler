import type { HNStory } from '../types.js';
import { fresh } from '../utils/freshness.js';

const BASE = 'https://hn.algolia.com/api/v1';

export async function searchHN(query: string, limit = 10): Promise<HNStory[]> {
  const url = `${BASE}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const data = await res.json() as { hits: any[] };
  return data.hits.map(h => ({
    ...fresh('hackernews'),
    id: h.objectID,
    title: h.title ?? '',
    url: h.url,
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    posted_at: h.created_at ?? '',
  }));
}

export async function getTopStories(limit = 10): Promise<HNStory[]> {
  const url = `${BASE}/search?tags=front_page&hitsPerPage=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN API error: ${res.status}`);
  const data = await res.json() as { hits: any[] };
  return data.hits.map(h => ({
    ...fresh('hackernews'),
    id: h.objectID,
    title: h.title ?? '',
    url: h.url,
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    posted_at: h.created_at ?? '',
  }));
}
