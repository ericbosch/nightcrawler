// FreshContext envelope — toda respuesta lleva metadata de frescura
export interface FreshContext {
  retrieved_at: string;   // ISO 8601
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Trend extends FreshContext {
  topic: string;
  volume?: number;
  score?: number;
  geo?: string;
}

export interface Post extends FreshContext {
  id: string;
  text: string;
  author: string;
  url: string;
  likes?: number;
  reposts?: number;
  posted_at?: string;
}

export interface Repo extends FreshContext {
  name: string;
  full_name: string;
  description?: string;
  url: string;
  stars: number;
  forks: number;
  language?: string;
  updated_at: string;
  topics?: string[];
}

export interface HNStory extends FreshContext {
  id: number;
  title: string;
  url?: string;
  score: number;
  comments: number;
  posted_at: string;
}

export interface ArxivPaper extends FreshContext {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  url: string;
  published: string;
}

export interface SearchResult extends FreshContext {
  title: string;
  url: string;
  snippet: string;
}

export interface LandscapeReport extends FreshContext {
  topic: string;
  repos: Repo[];
  hn_stories: HNStory[];
  arxiv_papers: ArxivPaper[];
}

export interface ResearchReport extends FreshContext {
  topic: string;
  depth: 'quick' | 'deep';
  trends?: Trend[];
  landscape?: LandscapeReport;
  web_results?: SearchResult[] | undefined;
  summary: string;
}

export interface FreshnessStatus {
  sources: Record<string, { last_updated: string | null; status: 'ok' | 'stale' | 'error' | 'never' }>;
}

export interface XFilters {
  since?: string;
  until?: string;
  min_likes?: number;
  lang?: string;
}

export interface NightcrawlerConfig {
  searxng?: { url: string };
  x?: { username?: string; password?: string };
  github?: { token?: string };
}
