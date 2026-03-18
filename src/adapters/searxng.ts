import type { SearchResult } from '../types.js';
import { fresh } from '../utils/freshness.js';
import { getSearxngUrl, getBraveKey } from '../utils/config.js';

export async function searchWeb(query: string, limit = 10): Promise<SearchResult[]> {
  try {
    return await searchSearxng(query, limit);
  } catch {
    return await searchBrave(query, limit);
  }
}

async function searchSearxng(query: string, limit: number): Promise<SearchResult[]> {
  const base = getSearxngUrl();
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&engines=general&language=en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`SearXNG error: ${res.status}`);
  const data = await res.json() as { results: any[] };
  return data.results.slice(0, limit).map(r => ({
    ...fresh('searxng'),
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.content ?? '',
  }));
}

async function searchBrave(query: string, limit: number): Promise<SearchResult[]> {
  const key = getBraveKey();
  if (!key) throw new Error('No Brave API key and SearXNG unavailable');
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const res = await fetch(url, { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Brave API error: ${res.status}`);
  const data = await res.json() as { web?: { results: any[] } };
  return (data.web?.results ?? []).map(r => ({
    ...fresh('brave'),
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.description ?? '',
  }));
}
