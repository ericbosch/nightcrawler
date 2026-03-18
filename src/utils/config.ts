import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import type { NightcrawlerConfig } from '../types.js';

const CONFIG_PATH = join(homedir(), '.config', 'nightcrawler', 'config.yaml');

export function loadConfig(): NightcrawlerConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return yaml.load(readFileSync(CONFIG_PATH, 'utf8')) as NightcrawlerConfig;
  } catch {
    return {};
  }
}

export function getSecret(key: string): string | undefined {
  return process.env[key];
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
