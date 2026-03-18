import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getLandscape, searchReposTool } from './tools/landscape.js';
import { research } from './tools/research.js';
import { getFreshnessStatus, markSource } from './utils/freshness.js';
import { getTrends, searchX } from './adapters/x.js';
import { getSearxngUrl } from './utils/config.js';
import { execSync } from 'child_process';

const server = new McpServer({
  name: 'nightcrawler',
  version: '1.0.0',
});

// Mark all sources so they appear in freshness status
['hackernews', 'github', 'arxiv', 'searxng', 'brave', 'x', 'landscape', 'research'].forEach(markSource);

// --- Capa 2: Landscape técnico ---

server.tool(
  'get_landscape',
  'Get technical landscape for a topic: GitHub repos, Hacker News stories, arXiv papers',
  { topic: z.string().describe('Topic to research') },
  async ({ topic }) => {
    const result = await getLandscape(topic);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'search_repos',
  'Search GitHub repositories ranked by recent activity',
  { query: z.string().describe('Search query') },
  async ({ query }) => {
    const result = await searchReposTool(query);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Capa 3: Síntesis ---

server.tool(
  'research',
  'Unified research report combining landscape + web search. depth=quick (landscape only) or deep (adds web search)',
  {
    topic: z.string().describe('Topic to research'),
    depth: z.enum(['quick', 'deep']).default('quick').describe('quick=landscape only, deep=adds web search'),
  },
  async ({ topic, depth }) => {
    const result = await research(topic, depth);
    return { content: [{ type: 'text', text: result.summary }] };
  }
);

server.tool(
  'get_freshness',
  'Get last update timestamps for all data sources',
  {},
  async () => {
    const result = getFreshnessStatus();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Capa 1: X/Twitter (Fase 3 — Playwright) ---

server.tool(
  'get_trends',
  'Get trending topics from X/Twitter. Requires X_USERNAME and X_PASSWORD in environment.',
  { geo: z.string().optional().describe('Geographic region hint (e.g. "ES", "US") — informational only') },
  async ({ geo }) => {
    const result = await getTrends(geo);
    if (result.length === 0) {
      return { content: [{ type: 'text', text: 'X/Twitter trends unavailable. Set X_USERNAME and X_PASSWORD in ~/.secrets to enable.' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'search_x',
  'Search X/Twitter posts via Playwright. Requires X_USERNAME and X_PASSWORD in environment.',
  {
    query: z.string().describe('Search query'),
    min_likes: z.number().optional().describe('Minimum likes filter'),
    lang: z.string().optional().describe('Language filter (e.g. "en", "es")'),
  },
  async ({ query, min_likes, lang }) => {
    const result = await searchX(query, min_likes ?? 0, lang);
    if (result.length === 0) {
      return { content: [{ type: 'text', text: 'X/Twitter search unavailable. Set X_USERNAME and X_PASSWORD in ~/.secrets to enable.' }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

async function ensureSearxng() {
  try {
    const res = await fetch(`${getSearxngUrl()}/healthz`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return;
  } catch {
    // not up
  }
  try {
    execSync('sudo systemctl start nightcrawler-searxng', { timeout: 10_000, stdio: 'ignore' });
  } catch {
    // best effort — Brave fallback handles the rest
  }
}

async function main() {
  await ensureSearxng();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
