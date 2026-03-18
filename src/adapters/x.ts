import type { Post, Trend } from '../types.js';
import { fresh } from '../utils/freshness.js';
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

async function loadSessionIntoContext(page: import('playwright-core').Page): Promise<boolean> {
  const saved = loadSession() as import('playwright-core').Cookie[];
  if (saved.length === 0) return false;
  await page.context().addCookies(saved);
  // Check auth_token cookie presence — no navigation needed
  return saved.some(c => c.name === 'auth_token');
}

async function ensureLoggedIn(page: import('playwright-core').Page): Promise<boolean> {
  return loadSessionIntoContext(page);
}

export async function getTrends(geo?: string): Promise<Trend[]> {
  const hasSession = existsSync(SESSION_PATH);
  if (!hasSession) return [];

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const loggedIn = await ensureLoggedIn(page);
    if (!loggedIn) return [];

    // Navigate to trending — use networkidle so JS renders the feed
    await page.goto('https://x.com/explore/tabs/trending', { waitUntil: 'networkidle', timeout: TIMEOUT }).catch(() => {});
    await page.waitForSelector('[data-testid="trend"]', { timeout: 8000 }).catch(() => {});

    // Extract trending items
    const trends = await page.evaluate(() => {
      const items: Array<{ topic: string; volume: number | null; category: string }> = [];
      document.querySelectorAll('[data-testid="trend"]').forEach((cell: Element) => {
        // Spans: ["rank", "·", "Category · Trending", "TopicName", ...]
        const spans = Array.from(cell.querySelectorAll('span'))
          .map((s: Element) => s.textContent?.trim() ?? '')
          .filter(t => t.length > 0);
        // Topic is typically the last unique meaningful span (not rank, not "·", not category descriptor)
        const topic = spans.filter(s => !s.match(/^\d+$/) && s !== '·' && !s.includes('Trending') && !s.includes('posts')).at(-1) ?? '';
        const category = spans.find(s => s.includes('Trending') || s.includes('·')) ?? '';
        const volumeSpan = spans.find(s => s.match(/[\d,.]+K?\s*posts?/i)) ?? '';
        const volumeMatch = volumeSpan.match(/([\d,.]+)(K)?/);
        const volume = volumeMatch?.[1] != null
          ? parseFloat(volumeMatch[1].replace(',', '')) * (volumeMatch[2] ? 1000 : 1)
          : null;
        if (topic) items.push({ topic, volume, category });
      });
      return items;
    });

    return trends.map(t => {
      const base = { ...fresh('x'), topic: t.topic, geo: geo ?? 'global', score: undefined as number | undefined };
      if (t.volume !== null) base.score = t.volume;
      const { score, ...rest } = base;
      return score !== undefined ? { ...rest, score } : rest;
    });
  } catch {
    return [];
  } finally {
    await browser.close();
  }
}

export async function searchX(query: string, minLikes = 0, lang?: string): Promise<Post[]> {
  const hasSession = existsSync(SESSION_PATH);
  if (!hasSession) return [];

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

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: TIMEOUT }).catch(() => {});
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 8000 }).catch(() => {});

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
