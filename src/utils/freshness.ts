import type { FreshContext, FreshnessStatus } from '../types.js';

const _lastUpdated: Record<string, string | null> = {};

export function fresh(source: string, confidence: FreshContext['confidence'] = 'high'): FreshContext {
  const now = new Date().toISOString();
  _lastUpdated[source] = now;
  return { retrieved_at: now, source, confidence };
}

export function getFreshnessStatus(): FreshnessStatus {
  return {
    sources: Object.fromEntries(
      Object.entries(_lastUpdated).map(([k, v]) => [
        k,
        {
          last_updated: v,
          status: v == null ? 'never' : isStale(v) ? 'stale' : 'ok',
        },
      ])
    ),
  };
}

export function markSource(source: string): void {
  _lastUpdated[source] ??= null;
}

function isStale(iso: string, maxAgeMs = 30 * 60 * 1000): boolean {
  return Date.now() - new Date(iso).getTime() > maxAgeMs;
}
