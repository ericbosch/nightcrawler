import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { DemoInMemoryAuthProvider } from '@modelcontextprotocol/sdk/examples/server/demoInMemoryOAuthProvider.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getLandscape, searchReposTool } from './tools/landscape.js';
import { research } from './tools/research.js';
import { getFreshnessStatus, markSource } from './utils/freshness.js';
import { getTrends, searchX } from './adapters/x.js';
import { searchWeb } from './adapters/searxng.js';
import { getSearxngUrl } from './utils/config.js';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import express from 'express';

// Mark all sources so they appear in freshness status
['hackernews', 'github', 'arxiv', 'searxng', 'brave', 'x', 'landscape', 'research'].forEach(markSource);

function createMcpServer(): McpServer {
  const srv = new McpServer({ name: 'nightcrawler', version: '1.0.0' });

  // --- Capa 2: Landscape técnico ---

  srv.tool(
    'get_landscape',
    'Get technical landscape for a topic: GitHub repos, Hacker News stories, arXiv papers',
    { topic: z.string().describe('Topic to research') },
    async ({ topic }) => {
      const result = await getLandscape(topic);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  srv.tool(
    'search_repos',
    'Search GitHub repositories ranked by recent activity',
    { query: z.string().describe('Search query') },
    async ({ query }) => {
      const result = await searchReposTool(query);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Capa 3: Síntesis ---

  srv.tool(
    'research',
    'Unified research report combining landscape + web search. depth=quick (landscape only) or deep (adds web search)',
    {
      topic: z.string().describe('Topic to research'),
      depth: z.enum(['quick', 'deep']).default('quick').describe('quick=landscape only, deep=adds web search'),
      web_mode: z.enum(['official', 'community', 'mixed']).default('official').describe('official=docs/vendor sites, community=forums, mixed=both'),
    },
    async ({ topic, depth, web_mode }) => {
      const result = await research(topic, depth, web_mode);
      return {
        content: [
          { type: 'text', text: result.summary },
          { type: 'text', text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );

  srv.tool(
    'search_web',
    'Search the web via SearXNG (fallback to Brave if configured)',
    {
      query: z.string().describe('Search query'),
      limit: z.number().int().min(1).max(20).default(10).describe('Number of results to return'),
      web_mode: z.enum(['official', 'community', 'mixed']).default('official').describe('official=docs/vendor sites, community=forums, mixed=both'),
    },
    async ({ query, limit, web_mode }) => {
      const results = await searchWeb(query, limit, web_mode);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );

  srv.tool(
    'get_freshness',
    'Get last update timestamps for all data sources',
    {},
    async () => {
      const result = getFreshnessStatus();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Capa 1: X/Twitter (Fase 3 — Playwright) ---

  srv.tool(
    'get_trends',
    'Get trending topics from X/Twitter. Requires session file at ~/.config/nightcrawler/x-session.json.',
    { geo: z.string().optional().describe('Geographic region hint (e.g. "ES", "US") — informational only') },
    async ({ geo }) => {
      const result = await getTrends(geo);
      if (result.length === 0) {
        return { content: [{ type: 'text', text: 'X/Twitter trends unavailable. Session file missing at ~/.config/nightcrawler/x-session.json — run node scripts/x-login.mjs to generate it.' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  srv.tool(
    'search_x',
    'Search X/Twitter posts via Playwright. Requires session file at ~/.config/nightcrawler/x-session.json.',
    {
      query: z.string().describe('Search query'),
      min_likes: z.number().optional().describe('Minimum likes filter'),
      lang: z.string().optional().describe('Language filter (e.g. "en", "es")'),
    },
    async ({ query, min_likes, lang }) => {
      const result = await searchX(query, min_likes ?? 0, lang);
      if (result.length === 0) {
        return { content: [{ type: 'text', text: 'X/Twitter search unavailable. Session file missing at ~/.config/nightcrawler/x-session.json — run node scripts/x-login.mjs to generate it.' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  return srv;
}

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

async function startHttp(port: number) {
  const PUBLIC_URL = process.env['MCP_PUBLIC_URL'] ?? 'https://elitebook.tail353084.ts.net';
  const issuerUrl = new URL(PUBLIC_URL);
  const mcpServerUrl = new URL(`${PUBLIC_URL}/mcp`);

  const authProvider = new DemoInMemoryAuthProvider();

  const app = express();
  app.set('trust proxy', 1); // Tailscale Funnel adds X-Forwarded-For
  app.use(express.json());

  // CORS — needed for browser-based clients (Claude.ai, etc.)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, Accept, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    console.error(`${req.method} ${req.url} session=${req.headers['mcp-session-id'] ?? 'none'}`);
    next();
  });

  // OAuth endpoints: /.well-known/*, /authorize, /token, /register, /revoke
  app.use(mcpAuthRouter({
    provider: authProvider,
    issuerUrl,
    resourceServerUrl: mcpServerUrl,
    scopesSupported: ['mcp:tools'],
    resourceName: 'nightcrawler',
  }));

  const bearerAuth = requireBearerAuth({
    verifier: authProvider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  });

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const mcpHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) {
        res.status(404).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Session not found' }, id: null });
        return;
      }
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // No session ID — must be an initialize request
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No session ID — send initialize first' }, id: null });
      return;
    }

    const t = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { sessions.set(id, t); },
    });
    t.onclose = () => { if (t.sessionId) sessions.delete(t.sessionId); };

    const srv = createMcpServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await srv.connect(t as any);
    await t.handleRequest(req, res, req.body);
  };

  app.post('/mcp', bearerAuth, mcpHandler);
  app.get('/mcp', bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const transport = sessionId ? sessions.get(sessionId) : undefined;
    if (!transport) { res.status(404).send('Session not found'); return; }
    await transport.handleRequest(req, res);
  });
  app.delete('/mcp', bearerAuth, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const transport = sessionId ? sessions.get(sessionId) : undefined;
    if (!transport) { res.status(404).send('Session not found'); return; }
    await transport.handleRequest(req, res);
  });

  const host = process.env['MCP_HOST'] ?? '127.0.0.1';
  app.listen(port, host, () => {
    console.error(`nightcrawler HTTP MCP listening on ${host}:${port}/mcp (OAuth enabled)`);
  });
}

async function main() {
  await ensureSearxng();
  const httpPort = process.argv.includes('--http')
    ? parseInt(process.argv[process.argv.indexOf('--http') + 1] ?? '3333', 10)
    : null;

  if (httpPort) {
    await startHttp(httpPort);
  } else {
    const transport = new StdioServerTransport();
    const srv = createMcpServer();
    await srv.connect(transport);
  }
}

main().catch(console.error);
