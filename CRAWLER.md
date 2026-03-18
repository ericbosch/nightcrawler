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
| 5 | Hardening, systemd | ✅ |

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

## Operaciones

```bash
# SearXNG
sudo systemctl start|stop|restart nightcrawler-searxng
sudo systemctl status nightcrawler-searxng

# Actualizar imagen SearXNG
sudo systemctl reload nightcrawler-searxng

# Ver logs SearXNG
sudo docker logs nightcrawler-searxng --tail 50
```

## Hardening completado (Fase 5)

- `nightcrawler-searxng.service` — arranca en boot, `WantedBy=multi-user.target`
- sudoers `/etc/sudoers.d/nightcrawler-searxng` — krinekk puede gestionar sin contraseña
- Auto-heal en `server.ts` — si SearXNG no responde al arrancar nightcrawler, lo levanta
- Fallback a Brave API si SearXNG no disponible
