import type { SearchResult } from '../types.js';
import { fresh } from '../utils/freshness.js';
import {
  getSearxngUrl,
  getBraveKey,
  getWebAllowlist,
  getWebDenylist,
  getWebAllowlistOfficial,
  getWebAllowlistCommunity,
  getWebDenylistDefault,
} from '../utils/config.js';

export async function searchWeb(
  query: string,
  limit = 10,
  mode: 'official' | 'community' | 'mixed' = 'official'
): Promise<SearchResult[]> {
  const allowlist =
    mode === 'official' ? getWebAllowlistOfficial()
    : mode === 'community' ? getWebAllowlistCommunity()
    : getWebAllowlist();
  const denylist = getWebDenylistDefault();
  try {
    return await searchSearxng(query, limit, allowlist, denylist);
  } catch {
    return await searchBrave(query, limit, allowlist, denylist);
  }
}

async function searchSearxng(query: string, limit: number, allowlist: string[], denylist: string[]): Promise<SearchResult[]> {
  const base = getSearxngUrl();
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&engines=general&language=en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`SearXNG error: ${res.status}`);
  const data = await res.json() as { results: any[] };
  const baseResults = data.results.map(r => ({
    ...fresh('searxng'),
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.content ?? '',
  }));

  let enriched = baseResults;
  if (allowlist.length > 0) {
    const siteQuery = `${query} (${allowlist.map(s => `site:${s}`).join(' OR ')})`;
    const url2 = `${base}/search?q=${encodeURIComponent(siteQuery)}&format=json&engines=general&language=en`;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(5000) });
    if (res2.ok) {
      const data2 = await res2.json() as { results: any[] };
      const allowResults = data2.results.map(r => ({
        ...fresh('searxng'),
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.content ?? '',
      }));
      enriched = dedupeResults([...allowResults, ...baseResults]);
    }
  }

  if (denylist.length > 0) {
    enriched = enriched.filter(r => !denylist.some(d => r.url.includes(d)));
  }
  return enriched.slice(0, limit);
}

async function searchBrave(query: string, limit: number, allowlist: string[], denylist: string[]): Promise<SearchResult[]> {
  const key = getBraveKey();
  if (!key) throw new Error('No Brave API key and SearXNG unavailable');
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const res = await fetch(url, { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Brave API error: ${res.status}`);
  const data = await res.json() as { web?: { results: any[] } };
  const baseResults = (data.web?.results ?? []).map(r => ({
    ...fresh('brave'),
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.description ?? '',
  }));
  let enriched = baseResults;
  if (allowlist.length > 0) {
    const siteQuery = `${query} (${allowlist.map(s => `site:${s}`).join(' OR ')})`;
    const url2 = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(siteQuery)}&count=${limit}`;
    const res2 = await fetch(url2, { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } });
    if (res2.ok) {
      const data2 = await res2.json() as { web?: { results: any[] } };
      const allowResults = (data2.web?.results ?? []).map(r => ({
        ...fresh('brave'),
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));
      enriched = dedupeResults([...allowResults, ...baseResults]);
    }
  }
  if (denylist.length > 0) {
    enriched = enriched.filter(r => !denylist.some(d => r.url.includes(d)));
  }
  return enriched.slice(0, limit);
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of results) {
    const key = r.url || r.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}
