import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getLandscape, searchReposTool } from './tools/landscape.js';
import { research } from './tools/research.js';
import { getFreshnessStatus, markSource } from './utils/freshness.js';

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

// --- Capa 1: X/Twitter (stub — Fase 3) ---

server.tool(
  'get_trends',
  '[Fase 3 — not implemented] Get trending topics from X/Twitter',
  { geo: z.string().optional().describe('Geographic region (e.g. "ES", "US")') },
  async () => {
    return { content: [{ type: 'text', text: 'X/Twitter integration pending (Fase 3 — requires Playwright auth)' }] };
  }
);

server.tool(
  'search_x',
  '[Fase 3 — not implemented] Search X/Twitter posts',
  {
    query: z.string(),
    min_likes: z.number().optional(),
    lang: z.string().optional(),
  },
  async () => {
    return { content: [{ type: 'text', text: 'X/Twitter integration pending (Fase 3 — requires Playwright auth)' }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
