import type { ArxivPaper } from '../types.js';
import { fresh } from '../utils/freshness.js';

const BASE = 'https://export.arxiv.org/api/query';

export async function searchArxiv(query: string, limit = 5): Promise<ArxivPaper[]> {
  const url = `${BASE}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arXiv API error: ${res.status}`);
  const xml = await res.text();
  return parseArxivXml(xml);
}

function parseArxivXml(xml: string): ArxivPaper[] {
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
  return entries.map(entry => {
    const get = (tag: string) => entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? '';
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(m => m[1]?.trim() ?? '');
    const rawId = get('id');
    const idParts = rawId.split('/abs/');
    const id = idParts.length > 1 ? idParts[1]! : rawId;
    return {
      ...fresh('arxiv'),
      id,
      title: get('title').replace(/\s+/g, ' '),
      summary: get('summary').replace(/\s+/g, ' ').slice(0, 300) + '...',
      authors,
      url: `https://arxiv.org/abs/${id}`,
      published: get('published'),
    };
  });
}
