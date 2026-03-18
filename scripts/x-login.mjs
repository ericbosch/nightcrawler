#!/usr/bin/env node
// Script de login manual para X/Twitter — guarda sesión en ~/.config/nightcrawler/x-session.json
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SESSION_PATH = join(homedir(), '.config', 'nightcrawler', 'x-session.json');
const dir = join(homedir(), '.config', 'nightcrawler');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

const page = await context.newPage();
await page.goto('https://x.com/login');
console.log('🌐 Navegador abierto en X/Twitter login.');
console.log('   Haz login en el navegador y espera...');

// Wait until we're on /home (up to 2 minutes)
try {
  await page.waitForURL('**/home', { timeout: 120_000 });
  const cookies = await context.cookies();
  writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2));
  console.log(`✅ Sesión guardada en ${SESSION_PATH} (${cookies.length} cookies)`);
} catch {
  console.error('❌ Timeout o login no completado');
} finally {
  await browser.close();
}
