import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import type { NightcrawlerConfig } from '../types.js';

const CONFIG_PATH = join(homedir(), '.config', 'nightcrawler', 'config.yaml');
const SECRETS_PATH = join(homedir(), '.secrets');
const SECRETS_LEGACY = join(homedir(), '.secrets.legacy');

function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cleaned = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = cleaned.indexOf('=');
    if (eq === -1) continue;
    const key = cleaned.slice(0, eq).trim();
    let value = cleaned.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadSecrets(): Record<string, string> {
  try {
    const out: Record<string, string> = {};

    if (existsSync(SECRETS_LEGACY)) {
      Object.assign(out, parseEnv(readFileSync(SECRETS_LEGACY, 'utf8')));
    }

    if (existsSync(SECRETS_PATH)) {
      const stats = statSync(SECRETS_PATH);
      if (stats.isFile()) {
        Object.assign(out, parseEnv(readFileSync(SECRETS_PATH, 'utf8')));
      } else if (stats.isDirectory()) {
        const files = readdirSync(SECRETS_PATH)
          .filter((f) => f.endsWith('.env'))
          .sort();
        for (const f of files) {
          Object.assign(out, parseEnv(readFileSync(join(SECRETS_PATH, f), 'utf8')));
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

let _secrets: Record<string, string> | null = null;
function secrets(): Record<string, string> {
  return (_secrets ??= loadSecrets());
}

export function loadConfig(): NightcrawlerConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return yaml.load(readFileSync(CONFIG_PATH, 'utf8')) as NightcrawlerConfig;
  } catch {
    return {};
  }
}

export function getSecret(key: string): string | undefined {
  return process.env[key] ?? secrets()[key];
}

export function getGithubToken(): string | undefined {
  return getSecret('GITHUB_TOKEN') ?? loadConfig().github?.token;
}

export function getBraveKey(): string | undefined {
  return getSecret('BRAVE_API_KEY');
}

export function getSearxngUrl(): string {
  return loadConfig().searxng?.url ?? 'http://localhost:8888';
}

export function getWebAllowlist(): string[] {
  return loadConfig().web?.allowlist ?? [];
}

export function getWebDenylist(): string[] {
  return loadConfig().web?.denylist ?? [];
}

export function getWebAllowlistOfficial(): string[] {
  return loadConfig().web?.allowlist_official ?? getWebAllowlist();
}

export function getWebAllowlistCommunity(): string[] {
  return loadConfig().web?.allowlist_community ?? [];
}

export function getWebDenylistDefault(): string[] {
  return loadConfig().web?.denylist_default ?? getWebDenylist();
}
