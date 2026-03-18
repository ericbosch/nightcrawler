# CLAUDE.md — nightcrawler

## Qué es esto
MCP server self-hosted para discovery de tendencias y research. Expone tools: landscape, research, web search y X/Twitter (Playwright).

## Primero lee
1. `CRAWLER.md`
2. `src/server.ts`
3. `src/tools/research.ts`
4. `src/adapters/searxng.ts`
5. `src/utils/config.ts`

## Reglas
- No romper compatibilidad MCP (stdio + HTTP).
- Todo output debe incluir FreshContext (retrieved_at, source, confidence).
- Preferir SearXNG local; Brave es fallback.
- No hardcodear secrets en el repo.

## Arranque rápido
```bash
cd ~/dev/nightcrawler
npm run dev
```

## Config
- `~/.config/nightcrawler/config.yaml`
- `~/.secrets/*.env` para `GITHUB_TOKEN`, `BRAVE_API_KEY`
- X/Twitter requiere `~/.config/nightcrawler/x-session.json`

## Tests / build
```bash
npm run build
```
