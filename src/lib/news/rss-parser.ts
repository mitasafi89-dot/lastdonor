import type { NormalizedNewsItem } from './gnews-client';

type RssFeedConfig = {
  url: string;
  source: string;
};

// All RSS feeds - organized by region and type for global coverage
// The pipeline handles fetch failures gracefully, so non-functional feeds are skipped silently.
export const RSS_FEEDS: RssFeedConfig[] = [
  // ─── Wire Services & Global ─────────────────────────────────────
  { url: 'https://feeds.apnews.com/rss/apf-topnews', source: 'AP News' },
  { url: 'https://feeds.reuters.com/reuters/topNews', source: 'Reuters' },
  { url: 'https://www.upi.com/rss/TopNews/', source: 'UPI' },

  // ─── US · Military / Veterans ───────────────────────────────────
  { url: 'https://www.dvidshub.net/rss/news', source: 'DVIDS' },
  { url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945', source: 'Defense.gov' },
  { url: 'https://www.stripes.com/rss', source: 'Stars and Stripes' },
  { url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/', source: 'Military Times' },
  { url: 'https://www.va.gov/rss/rss_PressRel.asp', source: 'VA Press' },

  // ─── US · First Responders ──────────────────────────────────────
  { url: 'https://www.odmp.org/rss/all', source: 'ODMP' },
  { url: 'https://apps.usfa.fema.gov/firefighter-fatalities/api/fatalityDatums/feed', source: 'USFA' },
  { url: 'https://www.firehouse.com/rss', source: 'Firehouse' },
  { url: 'https://www.firerescue1.com/rss/articles', source: 'FireRescue1' },
  { url: 'https://www.police1.com/rss/articles', source: 'Police1' },
  { url: 'https://www.ems1.com/rss/articles', source: 'EMS1' },

  // ─── US · National News ─────────────────────────────────────────
  { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR' },
  { url: 'https://feeds.npr.org/1003/rss.xml', source: 'NPR National' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml', source: 'NY Times US' },
  { url: 'https://feeds.washingtonpost.com/rss/national', source: 'Washington Post' },
  { url: 'https://www.latimes.com/california/rss2.0.xml', source: 'LA Times' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', source: 'NY Times' },
  { url: 'https://feeds.abcnews.com/abcnews/topstories', source: 'ABC News' },
  { url: 'https://feeds.cbsnews.com/CBSNewsMain', source: 'CBS News' },
  { url: 'https://feeds.nbcnews.com/nbcnews/public/news', source: 'NBC News' },
  { url: 'https://www.pbs.org/newshour/feeds/rss/headlines', source: 'PBS NewsHour' },
  { url: 'https://www.usatoday.com/rss/news/', source: 'USA Today' },

  // ─── US · Regional ──────────────────────────────────────────────
  { url: 'https://www.chicagotribune.com/arcio/rss/', source: 'Chicago Tribune' },
  { url: 'https://www.houstonchronicle.com/rss/feed/Breaking-News-Premium-702.php', source: 'Houston Chronicle' },
  { url: 'https://www.miamiherald.com/latest-news/index.rss', source: 'Miami Herald' },
  { url: 'https://www.denverpost.com/feed/', source: 'Denver Post' },
  { url: 'https://www.seattletimes.com/feed/', source: 'Seattle Times' },
  { url: 'https://www.dallasnews.com/arcio/rss/', source: 'Dallas Morning News' },
  { url: 'https://www.ajc.com/arc/outboundfeeds/rss/', source: 'Atlanta Journal-Constitution' },
  { url: 'https://www.bostonglobe.com/arc/outboundfeeds/rss/homepage/', source: 'Boston Globe' },
  { url: 'https://www.sfchronicle.com/feed/sfgate/news/bayarea/feed.xml', source: 'SF Chronicle' },
  { url: 'https://www.startribune.com/local/index.rss2', source: 'Star Tribune' },
  { url: 'https://www.azcentral.com/arcio/rss/', source: 'Arizona Republic' },
  { url: 'https://www.kansascity.com/latest-news/index.rss', source: 'Kansas City Star' },
  { url: 'https://www.oregonlive.com/arc/outboundfeeds/rss/', source: 'The Oregonian' },
  { url: 'https://www.phillymag.com/feed/', source: 'Philadelphia Magazine' },
  { url: 'https://www.detroitnews.com/arcio/rss/', source: 'Detroit News' },

  // ─── Canada ─────────────────────────────────────────────────────
  { url: 'https://www.cbc.ca/cmlink/rss-topstories', source: 'CBC News' },
  { url: 'https://www.cbc.ca/cmlink/rss-world', source: 'CBC World' },
  { url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/', source: 'Globe and Mail' },
  { url: 'https://nationalpost.com/feed', source: 'National Post' },
  { url: 'https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009', source: 'CTV News' },
  { url: 'https://globalnews.ca/feed/', source: 'Global News Canada' },

  // ─── UK & Ireland ───────────────────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', source: 'BBC News' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', source: 'BBC UK' },
  { url: 'https://www.theguardian.com/world/rss', source: 'The Guardian World' },
  { url: 'https://www.theguardian.com/uk/rss', source: 'The Guardian UK' },
  { url: 'https://www.theguardian.com/society/rss', source: 'The Guardian Society' },
  { url: 'https://feeds.skynews.com/feeds/rss/home.xml', source: 'Sky News' },
  { url: 'https://www.independent.co.uk/news/world/rss', source: 'The Independent' },
  { url: 'https://www.telegraph.co.uk/rss.xml', source: 'The Telegraph' },
  { url: 'https://www.irishmirror.ie/news/?service=rss', source: 'Irish Mirror' },
  { url: 'https://www.rte.ie/news/rss/news-headlines.xml', source: 'RTÉ News' },

  // ─── Europe ─────────────────────────────────────────────────────
  { url: 'https://www.dw.com/rss/en/top-stories/s-9097', source: 'DW News' },
  { url: 'https://www.dw.com/rss/en/eu/s-17044', source: 'DW Europe' },
  { url: 'https://www.france24.com/en/rss', source: 'France 24' },
  { url: 'https://www.euronews.com/rss', source: 'Euronews' },
  { url: 'https://www.thelocal.de/feed', source: 'The Local Germany' },
  { url: 'https://www.thelocal.fr/feed', source: 'The Local France' },
  { url: 'https://www.thelocal.it/feed', source: 'The Local Italy' },
  { url: 'https://www.thelocal.es/feed', source: 'The Local Spain' },
  { url: 'https://www.thelocal.se/feed', source: 'The Local Sweden' },
  { url: 'https://www.thelocal.no/feed', source: 'The Local Norway' },
  { url: 'https://www.swissinfo.ch/eng/top-news/rss', source: 'SWI swissinfo' },
  { url: 'https://www.dutchnews.nl/feed/', source: 'DutchNews' },

  // ─── Asia-Pacific ───────────────────────────────────────────────
  { url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', source: 'Channel News Asia' },
  { url: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/', source: 'NHK World' },
  { url: 'https://www.scmp.com/rss/91/feed', source: 'South China Morning Post' },
  { url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', source: 'Times of India' },
  { url: 'https://www.thehindu.com/news/national/feeder/default.rss', source: 'The Hindu' },
  { url: 'https://www.ndtv.com/rss/top-stories', source: 'NDTV' },
  { url: 'https://www.straitstimes.com/news/asia/rss.xml', source: 'Straits Times' },
  { url: 'https://www.bangkokpost.com/rss/data/topstories.xml', source: 'Bangkok Post' },
  { url: 'https://www.japantimes.co.jp/feed/', source: 'Japan Times' },
  { url: 'https://www.koreaherald.com/rss', source: 'Korea Herald' },
  { url: 'https://mb.com.ph/rss/news', source: 'Manila Bulletin' },
  { url: 'https://en.vietnamplus.vn/rss/news.rss', source: 'VietnamPlus' },
  { url: 'https://www.dawn.com/feeds/home', source: 'Dawn Pakistan' },
  { url: 'https://www.thedailystar.net/frontpage/rss.xml', source: 'Daily Star Bangladesh' },

  // ─── Oceania ────────────────────────────────────────────────────
  { url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', source: 'ABC Australia' },
  { url: 'https://www.abc.net.au/news/feed/51120/rss.xml', source: 'ABC Australia Top' },
  { url: 'https://www.sbs.com.au/news/feed', source: 'SBS News' },
  { url: 'https://www.smh.com.au/rss/feed.xml', source: 'Sydney Morning Herald' },
  { url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/curated/78/', source: 'NZ Herald' },
  { url: 'https://www.stuff.co.nz/rss', source: 'Stuff NZ' },
  { url: 'https://www.rnz.co.nz/rss/national.xml', source: 'RNZ' },

  // ─── Middle East ────────────────────────────────────────────────
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://www.middleeasteye.net/rss', source: 'Middle East Eye' },
  { url: 'https://www.arabnews.com/rss.xml', source: 'Arab News' },
  { url: 'https://gulfnews.com/rss', source: 'Gulf News' },
  { url: 'https://www.timesofisrael.com/feed/', source: 'Times of Israel' },
  { url: 'https://english.alarabiya.net/tools/rss', source: 'Al Arabiya' },
  { url: 'https://www.dailysabah.com/rssFeed/world', source: 'Daily Sabah' },

  // ─── Africa ─────────────────────────────────────────────────────
  { url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', source: 'AllAfrica' },
  { url: 'https://www.news24.com/news24/rss', source: 'News24 South Africa' },
  { url: 'https://www.iol.co.za/cmlink/1.640', source: 'IOL South Africa' },
  { url: 'https://www.nation.africa/rss.xml', source: 'Daily Nation Kenya' },
  { url: 'https://punchng.com/feed/', source: 'Punch Nigeria' },
  { url: 'https://guardian.ng/feed/', source: 'Guardian Nigeria' },
  { url: 'https://www.premiumtimesng.com/feed', source: 'Premium Times Nigeria' },
  { url: 'https://www.monitor.co.ug/rss.xml', source: 'Daily Monitor Uganda' },
  { url: 'https://www.chronicle.co.zw/feed/', source: 'Chronicle Zimbabwe' },
  { url: 'https://www.myjoyonline.com/feed/', source: 'Joy Online Ghana' },

  // ─── Latin America & Caribbean ──────────────────────────────────
  { url: 'https://www.batimes.com.ar/feed', source: 'Buenos Aires Times' },
  { url: 'https://ticotimes.net/feed', source: 'Tico Times' },
  { url: 'https://www.jamaicaobserver.com/feed/', source: 'Jamaica Observer' },
  { url: 'https://trinidadexpress.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc', source: 'Trinidad Express' },
  { url: 'https://mexiconewsdaily.com/feed/', source: 'Mexico News Daily' },

  // ─── Humanitarian / Disaster / Relief ───────────────────────────
  { url: 'https://reliefweb.int/updates/rss.xml', source: 'ReliefWeb' },
  { url: 'https://www.unicef.org/press-releases/rss', source: 'UNICEF' },
  { url: 'https://www.who.int/feeds/entity/mediacentre/news/en/rss.xml', source: 'WHO News' },
  { url: 'https://www.icrc.org/en/rss', source: 'ICRC' },
  { url: 'https://www.unhcr.org/rss/news', source: 'UNHCR' },
  { url: 'https://www.thenewhumanitarian.org/rss.xml', source: 'The New Humanitarian' },
  { url: 'https://www.ifrc.org/rss.xml', source: 'IFRC' },
  { url: 'https://www.rescue.org/feed', source: 'IRC' },
  { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', source: 'UN News' },
  { url: 'https://www.undispatch.com/feed/', source: 'UN Dispatch' },
  { url: 'https://www.devex.com/news/rss', source: 'Devex' },
  { url: 'https://www.globalcitizen.org/en/rss/', source: 'Global Citizen' },
  { url: 'https://www.gofundme.com/c/feed', source: 'GoFundMe Stories' },
];

/**
 * Parse an RSS/Atom XML feed into normalized news items.
 * Uses native DOMParser-style parsing (regex-based for Node.js without heavy XML deps).
 */
export async function fetchRssFeed(config: RssFeedConfig): Promise<NormalizedNewsItem[]> {
  try {
    const response = await fetch(config.url, {
      headers: { 'User-Agent': 'LastDonor.org News Aggregator' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`RSS fetch failed for ${config.source}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return parseRssXml(xml, config.source);
  } catch (error) {
    console.error(`RSS fetch error for ${config.source}:`, error);
    return [];
  }
}

/**
 * Parse RSS/Atom XML into normalized items using regex.
 * Handles both RSS 2.0 (<item>) and Atom (<entry>) formats.
 */
function parseRssXml(xml: string, source: string): NormalizedNewsItem[] {
  const items: NormalizedNewsItem[] = [];

  // Try RSS 2.0 format first
  const rssItemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = rssItemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTagContent(itemXml, 'title');
    const link = extractTagContent(itemXml, 'link') ?? extractAttr(itemXml, 'link', 'href');
    const description = extractTagContent(itemXml, 'description');
    const pubDate = extractTagContent(itemXml, 'pubDate');
    const imageUrl = extractImageUrl(itemXml);

    if (title && link) {
      items.push({
        title: decodeXmlEntities(title),
        url: link.trim(),
        summary: description ? decodeXmlEntities(stripHtml(description)).slice(0, 500) : '',
        source,
        publishedAt: pubDate ? new Date(pubDate) : null,
        imageUrl,
      });
    }
  }

  // If no RSS items found, try Atom format
  if (items.length === 0) {
    const atomEntryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = atomEntryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const title = extractTagContent(entryXml, 'title');
      const link = extractAttr(entryXml, 'link', 'href');
      const summary = extractTagContent(entryXml, 'summary') ?? extractTagContent(entryXml, 'content');
      const updated = extractTagContent(entryXml, 'updated') ?? extractTagContent(entryXml, 'published');

      if (title && link) {
        const imageUrl = extractImageUrl(entryXml);
        items.push({
          title: decodeXmlEntities(title),
          url: link.trim(),
          summary: summary ? decodeXmlEntities(stripHtml(summary)).slice(0, 500) : '',
          source,
          publishedAt: updated ? new Date(updated) : null,
          imageUrl,
        });
      }
    }
  }

  return items;
}

function extractTagContent(xml: string, tag: string): string | null {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1];

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = regex.exec(xml);
  return match?.[1] ?? null;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = regex.exec(xml);
  return match?.[1] ?? null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Extract image URL from RSS/Atom item XML.
 * Checks <enclosure>, <media:content>, <media:thumbnail>, and inline <img> tags.
 */
function extractImageUrl(xml: string): string | undefined {
  // <enclosure url="..." type="image/...">
  const enclosureMatch = /<enclosure[^>]+url="([^"]+)"[^>]*type="image\/[^"]*"/i.exec(xml)
    ?? /<enclosure[^>]+type="image\/[^"]*"[^>]*url="([^"]+)"/i.exec(xml);
  if (enclosureMatch) return enclosureMatch[1];

  // <media:content url="...">
  const mediaMatch = /<media:content[^>]+url="([^"]+)"/i.exec(xml);
  if (mediaMatch) return mediaMatch[1];

  // <media:thumbnail url="...">
  const thumbMatch = /<media:thumbnail[^>]+url="([^"]+)"/i.exec(xml);
  if (thumbMatch) return thumbMatch[1];

  // Inline <img> in description/content
  const imgMatch = /<img[^>]+src="(https?:\/\/[^"]+)"/i.exec(xml);
  if (imgMatch) return imgMatch[1];

  return undefined;
}

/**
 * Fetch all configured RSS feeds in parallel.
 */
/** Max items to keep per individual RSS feed to prevent any single source from dominating */
const MAX_ITEMS_PER_FEED = 25;

export async function fetchAllRssFeeds(): Promise<NormalizedNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((config) => fetchRssFeed(config)),
  );

  const items: NormalizedNewsItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      // Cap per feed - keep the most recent items
      const feedItems = result.value
        .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
        .slice(0, MAX_ITEMS_PER_FEED);
      items.push(...feedItems);
    }
  }

  return items;
}
