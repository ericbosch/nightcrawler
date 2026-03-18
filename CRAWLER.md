# CRAWLER.md — nightcrawler agent instructions

MCP server de inteligencia de tendencias para el ecosistema krinekk.
Arquitectura completa: https://www.notion.so/326337d15dbd8107a6f0de3468cdfe6c

## Estado de implementación

| Fase | Qué | Estado |
|------|-----|--------|
| 1 | Fundación (server, types, config, freshness) | ✅ |
| 2 | Adapters sin X (HN, GitHub, arXiv, SearXNG/Brave) | ✅ |
| 3 | X/Twitter via Playwright | ✅ |
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
- `X_USERNAME` — usuario X/Twitter para Playwright (pendiente de añadir)
- `X_PASSWORD` — contraseña X/Twitter (pendiente de añadir)

## SearXNG

Docker en `~/dev/nightcrawler/docker/`:
```bash
cd ~/dev/nightcrawler/docker && sudo docker compose up -d
```
Puerto: http://localhost:8888 (solo localhost)

## Próximo paso (Fase 5)

Hardening: systemd unit para SearXNG y nightcrawler en modo daemon.
