import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import type { NightcrawlerConfig } from '../types.js';

const CONFIG_PATH = join(homedir(), '.config', 'nightcrawler', 'config.yaml');
const SECRETS_PATH = join(homedir(), '.secrets');

function loadSecrets(): Record<string, string> {
  if (!existsSync(SECRETS_PATH)) return {};
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(SECRETS_PATH, 'utf8').split('\n')) {
      const m = line.match(/^export\s+(\w+)="([^"]*)"$/);
      if (m?.[1] && m[2] !== undefined) out[m[1]] = m[2];
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
