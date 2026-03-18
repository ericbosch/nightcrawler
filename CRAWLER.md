# CRAWLER.md — nightcrawler agent instructions

MCP server de inteligencia de tendencias para el ecosistema krinekk.
Arquitectura completa: https://www.notion.so/326337d15dbd8107a6f0de3468cdfe6c

## Estado de implementación

| Fase | Qué | Estado |
|------|-----|--------|
| 1 | Fundación (server, types, config, freshness) | ✅ |
| 2 | Adapters sin X (HN, GitHub, arXiv, SearXNG/Brave) | ✅ |
| 3 | X/Twitter via Playwright | ⏳ pendiente |
| 4 | Web search + síntesis avanzada | ✅ parcial |
| 5 | Hardening, SSE, systemd | ⏳ pendiente |

## Tools disponibles

- `get_landscape(topic)` — GitHub repos + HN + arXiv
- `search_repos(query)` — búsqueda GitHub rankeada
- `research(topic, depth)` — informe unificado (quick/deep)
- `get_freshness()` — timestamps por fuente
- `get_trends(geo?)` — [Fase 3] trends X/Twitter
- `search_x(query)` — [Fase 3] búsqueda X/Twitter

## Arranque dev

```bash
cd ~/dev/nightcrawler
npm run dev   # tsx directo, sin compilar
```

## Secrets requeridos

En `~/.secrets`:
- `GITHUB_TOKEN` — aumenta rate limit GitHub (ya disponible)
- `BRAVE_API_KEY` — fallback si SearXNG no está activo (ya disponible)

## Próximo paso (Fase 3)

Implementar `adapters/x.ts` con Playwright. Ver nota sobre browser-use en la arquitectura.
