import type { Post, Trend } from '../types.js';
import { fresh } from '../utils/freshness.js';
import { getSecret } from '../utils/config.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SESSION_PATH = join(homedir(), '.config', 'nightcrawler', 'x-session.json');
const TIMEOUT = 15_000;

function ensureDir(p: string) {
  const dir = join(p, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadSession(): object[] {
  if (!existsSync(SESSION_PATH)) return [];
  try {
    return JSON.parse(readFileSync(SESSION_PATH, 'utf8')) as object[];
  } catch {
    return [];
  }
}

function saveSession(cookies: object[]) {
  ensureDir(SESSION_PATH);
  writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2));
}

async function launchBrowser() {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });
  return browser;
}

async function ensureLoggedIn(page: import('playwright-core').Page): Promise<boolean> {
  const username = getSecret('X_USERNAME');
  const password = getSecret('X_PASSWORD');
  if (!username || !password) return false;

  // Load saved session cookies
  const saved = loadSession() as import('playwright-core').Cookie[];
  if (saved.length > 0) {
    await page.context().addCookies(saved);
  }

  // Check if already logged in
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  const url = page.url();
  if (url.includes('/home') && !url.includes('/login')) {
    return true;
  }

  // Login flow
  await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForTimeout(2000);

  // Enter username
  const userInput = page.locator('input[autocomplete="username"]').first();
  await userInput.fill(username);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Enter password
  const passInput = page.locator('input[name="password"]').first();
  await passInput.fill(password);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // Save session
  const cookies = await page.context().cookies();
  if (cookies.length > 0) saveSession(cookies);

  return page.url().includes('/home');
}

export async function getTrends(geo?: string): Promise<Trend[]> {
  const username = getSecret('X_USERNAME');
  if (!username) return [];

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const loggedIn = await ensureLoggedIn(page);
    if (!loggedIn) return [];

    // Navigate to trending — use explore page
    await page.goto('https://x.com/explore/tabs/trending', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    // Extract trending items
    const trends = await page.evaluate(() => {
      const items: Array<{ topic: string; volume: number | null }> = [];
      const cells = document.querySelectorAll('[data-testid="trend"]');
      cells.forEach((cell: Element) => {
        const topicEl = cell.querySelector('[dir="ltr"] span');
        const volumeEl = cell.querySelector('[dir="ltr"] ~ span');
        if (topicEl?.textContent) {
          const volumeText = volumeEl?.textContent ?? '';
          const volumeMatch = volumeText.match(/([\d,.]+)K?/);
          const volume = volumeMatch?.[1] != null
            ? parseFloat(volumeMatch[1].replace(',', '')) * (volumeText.includes('K') ? 1000 : 1)
            : null;
          items.push({ topic: topicEl.textContent.trim(), volume });
        }
      });
      return items;
    });

    return trends.map(t => {
      const base = { ...fresh('x'), topic: t.topic, geo: geo ?? 'global' };
      return t.volume !== null ? { ...base, volume: t.volume } : base;
    });
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}

export async function searchX(query: string, minLikes = 0, lang?: string): Promise<Post[]> {
  const username = getSecret('X_USERNAME');
  if (!username) return [];

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const loggedIn = await ensureLoggedIn(page);
    if (!loggedIn) return [];

    // Build search URL
    let q = query;
    if (lang) q += ` lang:${lang}`;
    if (minLikes > 0) q += ` min_faves:${minLikes}`;
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(2500);

    const posts = await page.evaluate(() => {
      const results: Array<{
        id: string;
        text: string;
        author: string;
        url: string;
        likes: number;
        reposts: number;
        posted_at: string;
      }> = [];

      const parseCount = (el: Element | null): number => {
        const txt = el?.textContent?.trim() ?? '0';
        if (txt.endsWith('K')) return parseFloat(txt) * 1000;
        if (txt.endsWith('M')) return parseFloat(txt) * 1_000_000;
        return parseInt(txt.replace(/,/g, ''), 10) || 0;
      };

      document.querySelectorAll('[data-testid="tweet"]').forEach((tweet: Element) => {
        const textEl = tweet.querySelector('[data-testid="tweetText"]');
        const authorEl = tweet.querySelector('[data-testid="User-Name"] a[href^="/"]');
        const timeEl = tweet.querySelector('time');
        const likesEl = tweet.querySelector('[data-testid="like"] span[data-testid="app-text-transition-container"]');
        const repostsEl = tweet.querySelector('[data-testid="retweet"] span[data-testid="app-text-transition-container"]');
        const linkEl = tweet.querySelector('a[href*="/status/"]');

        if (!textEl || !authorEl) return;

        const href = linkEl?.getAttribute('href') ?? '';
        const statusMatch = href.match(/\/status\/(\d+)/);
        const id = statusMatch?.[1] ?? Math.random().toString(36).slice(2);

        results.push({
          id,
          text: textEl.textContent?.trim() ?? '',
          author: authorEl.getAttribute('href')?.slice(1) ?? '',
          url: `https://x.com${href}`,
          likes: parseCount(likesEl),
          reposts: parseCount(repostsEl),
          posted_at: timeEl?.getAttribute('datetime') ?? '',
        });
      });

      return results;
    });

    return posts.map(p => ({
      ...fresh('x'),
      id: p.id,
      text: p.text,
      author: p.author,
      url: p.url,
      likes: p.likes,
      reposts: p.reposts,
      posted_at: p.posted_at,
    }));
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}
