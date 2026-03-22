# AI_GUIDE.md — nightcrawler

Canonical guide for AI agents in this repository.

## Purpose

`nightcrawler` is a self-hosted MCP server for research and trend discovery.
Core outputs should remain source-grounded and operationally stable.

## Read First

1. `CRAWLER.md`
2. `src/server.ts`
3. `src/tools/research.ts`
4. `src/adapters/searxng.ts`
5. `src/utils/config.ts`

## Useful Commands

```bash
cd /home/krinekk/dev/nightcrawler
npm ci
npm run dev
npm run build
```

## Tooling Notes

- TypeScript (ESM) project.
- Primary web retrieval should prefer local SearXNG; Brave as fallback.
- Runtime config is outside repo in user config/secrets paths.

## Guardrails

- Do not hardcode secrets.
- Preserve MCP compatibility.
- Keep tool outputs structured and auditable.
- Validate with `npm run build` after changes.
