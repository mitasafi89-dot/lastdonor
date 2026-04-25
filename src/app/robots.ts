import type { MetadataRoute } from 'next';

const PRIVATE_PATHS = ['/admin/', '/api/', '/login', '/register', '/dashboard', '/profile'];
const PUBLIC_AI_PATHS = [
  '/',
  '/campaigns',
  '/campaigns/category/',
  '/compare',
  '/completed-campaigns',
  '/blog',
  '/about',
  '/how-it-works',
  '/transparency',
  '/editorial-standards',
  '/share-your-story',
  '/last-donor-wall',
  '/donate',
  '/privacy',
  '/terms',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow public content, block private routes
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      // Google AI (Gemini training, Google SGE) - allow indexing, block training on private data
      {
        userAgent: 'Google-Extended',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // OpenAI GPT crawler - allow public content
      {
        userAgent: 'GPTBot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // Anthropic Claude crawler
      {
        userAgent: 'ClaudeBot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // Perplexity AI
      {
        userAgent: 'PerplexityBot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // Meta AI
      {
        userAgent: 'FacebookBot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // Apple Applebot (Siri, Spotlight)
      {
        userAgent: 'Applebot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // Common AI scrapers - block to protect donor/recipient data
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      // OpenAI's web search crawler (ChatGPT browsing plugin).
      // Distinct from GPTBot (training). Without an explicit rule it falls back
      // to the wildcard '*' which allows '/' but does not apply the optimized
      // AI-specific allow-list for /campaigns, /blog, etc.
      {
        userAgent: 'OAI-SearchBot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // DuckDuckGo AI Answers crawler
      {
        userAgent: 'DuckAssistBot',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // Anthropic's training crawler - separate from ClaudeBot (browsing)
      {
        userAgent: 'anthropic-ai',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
      // ByteDance / TikTok AI crawler
      {
        userAgent: 'Bytespider',
        allow: PUBLIC_AI_PATHS,
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: 'https://lastdonor.org/sitemap.xml',
    host: 'https://lastdonor.org',
  };
}
