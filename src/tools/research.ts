import type { ResearchReport } from '../types.js';
import { getLandscape } from './landscape.js';
import { searchWeb } from '../adapters/searxng.js';
import { fresh } from '../utils/freshness.js';

export async function research(
  topic: string,
  depth: 'quick' | 'deep' = 'quick',
  web_mode: 'official' | 'community' | 'mixed' = 'official'
): Promise<ResearchReport> {
  const landscape = await getLandscape(topic);

  const web_results = depth === 'deep'
    ? await searchWeb(topic, 10, web_mode).catch(() => [])
    : undefined;

  const topRepos = landscape.repos.slice(0, 3).map(r => `- ${r.full_name} ⭐${r.stars}: ${r.description ?? ''}`).join('\n');
  const topHN = landscape.hn_stories.slice(0, 3).map(h => `- ${h.title} (${h.score}pts)`).join('\n');
  const topArxiv = landscape.arxiv_papers.slice(0, 2).map(p => `- ${p.title}`).join('\n');
  const topWeb = web_results?.slice(0, 3).map(w => `- ${w.title}: ${w.snippet}`).join('\n') ?? '';

  const summary = [
    `## Research: ${topic}`,
    topRepos ? `### Top repos\n${topRepos}` : '',
    topHN ? `### Hacker News\n${topHN}` : '',
    topArxiv ? `### arXiv\n${topArxiv}` : '',
    topWeb ? `### Web\n${topWeb}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    ...fresh('research'),
    topic,
    depth,
    web_mode,
    landscape,
    web_results,
    summary,
  };
}
