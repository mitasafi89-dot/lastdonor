/**
 * Keyword Bank - curated keyword data for blog topic generation.
 * Organized by cause category with primary/secondary keywords, search volume estimates,
 * keyword difficulty (KD), and search intent classification.
 */

export interface KeywordEntry {
  keyword: string;
  volume: number; // monthly search volume estimate
  kd: number; // keyword difficulty 0-100
  intent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  category: string;
  isLongTail: boolean;
}

export interface KeywordCluster {
  category: string;
  label: string;
  keywords: KeywordEntry[];
}

const KEYWORD_BANK: KeywordCluster[] = [
  {
    category: 'medical',
    label: 'Medical & Health',
    keywords: [
      { keyword: 'how to help someone with medical bills', volume: 2900, kd: 12, intent: 'informational', category: 'medical', isLongTail: true },
      { keyword: 'medical fundraising ideas', volume: 1600, kd: 15, intent: 'informational', category: 'medical', isLongTail: true },
      { keyword: 'how to pay for surgery without insurance', volume: 3200, kd: 18, intent: 'informational', category: 'medical', isLongTail: true },
      { keyword: 'help with medical debt', volume: 4400, kd: 22, intent: 'informational', category: 'medical', isLongTail: false },
      { keyword: 'crowdfunding for medical expenses', volume: 1900, kd: 14, intent: 'transactional', category: 'medical', isLongTail: true },
      { keyword: 'fundraise for cancer treatment', volume: 1200, kd: 10, intent: 'transactional', category: 'medical', isLongTail: true },
      { keyword: 'medical bill assistance programs', volume: 2100, kd: 20, intent: 'informational', category: 'medical', isLongTail: true },
      { keyword: 'how to start a medical fundraiser', volume: 880, kd: 8, intent: 'informational', category: 'medical', isLongTail: true },
    ],
  },
  {
    category: 'memorial',
    label: 'Memorial & Funeral',
    keywords: [
      { keyword: 'how to help a family pay for a funeral', volume: 3600, kd: 10, intent: 'informational', category: 'memorial', isLongTail: true },
      { keyword: 'average funeral cost', volume: 12100, kd: 25, intent: 'informational', category: 'memorial', isLongTail: false },
      { keyword: 'funeral fundraiser ideas', volume: 1300, kd: 8, intent: 'informational', category: 'memorial', isLongTail: true },
      { keyword: 'how to raise money for a funeral', volume: 2400, kd: 12, intent: 'informational', category: 'memorial', isLongTail: true },
      { keyword: 'crowdfund funeral expenses', volume: 720, kd: 6, intent: 'transactional', category: 'memorial', isLongTail: true },
      { keyword: 'memorial fund for family', volume: 1100, kd: 9, intent: 'informational', category: 'memorial', isLongTail: true },
      { keyword: 'what to do when you cant afford a funeral', volume: 2900, kd: 14, intent: 'informational', category: 'memorial', isLongTail: true },
      { keyword: 'funeral assistance programs', volume: 4800, kd: 20, intent: 'informational', category: 'memorial', isLongTail: true },
    ],
  },
  {
    category: 'disaster',
    label: 'Disaster Relief',
    keywords: [
      { keyword: 'how to help after a house fire', volume: 2400, kd: 8, intent: 'informational', category: 'disaster', isLongTail: true },
      { keyword: 'how to help hurricane victims', volume: 5400, kd: 16, intent: 'informational', category: 'disaster', isLongTail: true },
      { keyword: 'donate to disaster relief', volume: 3100, kd: 22, intent: 'transactional', category: 'disaster', isLongTail: false },
      { keyword: 'fire victim assistance', volume: 1800, kd: 12, intent: 'informational', category: 'disaster', isLongTail: true },
      { keyword: 'how to rebuild after a natural disaster', volume: 1400, kd: 10, intent: 'informational', category: 'disaster', isLongTail: true },
      { keyword: 'disaster fundraiser ideas', volume: 590, kd: 5, intent: 'informational', category: 'disaster', isLongTail: true },
      { keyword: 'help family after tornado', volume: 880, kd: 6, intent: 'informational', category: 'disaster', isLongTail: true },
      { keyword: 'flood relief donation', volume: 1200, kd: 14, intent: 'transactional', category: 'disaster', isLongTail: true },
    ],
  },
  {
    category: 'military',
    label: 'Military & Veterans',
    keywords: [
      { keyword: 'help military families in need', volume: 1900, kd: 10, intent: 'informational', category: 'military', isLongTail: true },
      { keyword: 'veteran fundraising ideas', volume: 880, kd: 8, intent: 'informational', category: 'military', isLongTail: true },
      { keyword: 'support deployed military families', volume: 720, kd: 6, intent: 'informational', category: 'military', isLongTail: true },
      { keyword: 'military family assistance programs', volume: 2400, kd: 18, intent: 'informational', category: 'military', isLongTail: true },
      { keyword: 'donate to veterans', volume: 3600, kd: 24, intent: 'transactional', category: 'military', isLongTail: false },
      { keyword: 'gold star family support', volume: 590, kd: 5, intent: 'informational', category: 'military', isLongTail: true },
      { keyword: 'wounded warrior fundraiser', volume: 1300, kd: 16, intent: 'transactional', category: 'military', isLongTail: true },
      { keyword: 'how to help a veteran in crisis', volume: 1100, kd: 8, intent: 'informational', category: 'military', isLongTail: true },
    ],
  },
  {
    category: 'first-responders',
    label: 'First Responders',
    keywords: [
      { keyword: 'help firefighter families', volume: 720, kd: 6, intent: 'informational', category: 'first-responders', isLongTail: true },
      { keyword: 'first responder fundraiser', volume: 590, kd: 5, intent: 'informational', category: 'first-responders', isLongTail: true },
      { keyword: 'police officer memorial fund', volume: 880, kd: 8, intent: 'informational', category: 'first-responders', isLongTail: true },
      { keyword: 'ems worker support fund', volume: 320, kd: 3, intent: 'informational', category: 'first-responders', isLongTail: true },
      { keyword: 'fallen firefighter family assistance', volume: 480, kd: 5, intent: 'informational', category: 'first-responders', isLongTail: true },
      { keyword: 'line of duty death fundraiser', volume: 390, kd: 4, intent: 'informational', category: 'first-responders', isLongTail: true },
    ],
  },
  {
    category: 'community',
    label: 'Community & Neighbors',
    keywords: [
      { keyword: 'how to help a neighbor in need', volume: 1600, kd: 8, intent: 'informational', category: 'community', isLongTail: true },
      { keyword: 'community fundraiser ideas', volume: 3200, kd: 14, intent: 'informational', category: 'community', isLongTail: true },
      { keyword: 'ways to help your community', volume: 4400, kd: 18, intent: 'informational', category: 'community', isLongTail: false },
      { keyword: 'neighborhood fundraiser', volume: 880, kd: 6, intent: 'informational', category: 'community', isLongTail: true },
      { keyword: 'small town fundraising ideas', volume: 1200, kd: 10, intent: 'informational', category: 'community', isLongTail: true },
      { keyword: 'community support for families', volume: 720, kd: 7, intent: 'informational', category: 'community', isLongTail: true },
    ],
  },
  {
    category: 'education',
    label: 'Education & School',
    keywords: [
      { keyword: 'school fundraiser ideas', volume: 6600, kd: 22, intent: 'informational', category: 'education', isLongTail: false },
      { keyword: 'help student pay for college', volume: 2900, kd: 16, intent: 'informational', category: 'education', isLongTail: true },
      { keyword: 'education fundraising', volume: 1900, kd: 14, intent: 'informational', category: 'education', isLongTail: false },
      { keyword: 'crowdfund tuition', volume: 590, kd: 6, intent: 'transactional', category: 'education', isLongTail: true },
      { keyword: 'teacher classroom fundraiser', volume: 880, kd: 8, intent: 'informational', category: 'education', isLongTail: true },
      { keyword: 'scholarship fundraiser ideas', volume: 1200, kd: 10, intent: 'informational', category: 'education', isLongTail: true },
    ],
  },
  {
    category: 'animal',
    label: 'Animal & Pet',
    keywords: [
      { keyword: 'how to fundraise for vet bills', volume: 1600, kd: 8, intent: 'informational', category: 'animal', isLongTail: true },
      { keyword: 'help pay for pet surgery', volume: 2400, kd: 12, intent: 'informational', category: 'animal', isLongTail: true },
      { keyword: 'animal rescue fundraiser', volume: 1300, kd: 10, intent: 'informational', category: 'animal', isLongTail: true },
      { keyword: 'pet emergency fund', volume: 1900, kd: 14, intent: 'informational', category: 'animal', isLongTail: true },
      { keyword: 'crowdfunding for pet medical bills', volume: 720, kd: 5, intent: 'transactional', category: 'animal', isLongTail: true },
    ],
  },
  {
    category: 'emergency',
    label: 'Emergency & Crisis',
    keywords: [
      { keyword: 'emergency fundraiser', volume: 1600, kd: 10, intent: 'transactional', category: 'emergency', isLongTail: false },
      { keyword: 'help in a financial emergency', volume: 2400, kd: 14, intent: 'informational', category: 'emergency', isLongTail: true },
      { keyword: 'emergency financial assistance', volume: 5400, kd: 22, intent: 'informational', category: 'emergency', isLongTail: true },
      { keyword: 'crisis fundraising tips', volume: 480, kd: 4, intent: 'informational', category: 'emergency', isLongTail: true },
      { keyword: 'urgent help needed fundraiser', volume: 590, kd: 5, intent: 'transactional', category: 'emergency', isLongTail: true },
    ],
  },
  {
    category: 'family',
    label: 'Family & Personal',
    keywords: [
      { keyword: 'how to start a fundraiser for a family', volume: 2900, kd: 10, intent: 'informational', category: 'family', isLongTail: true },
      { keyword: 'help a family in need', volume: 3600, kd: 14, intent: 'informational', category: 'family', isLongTail: false },
      { keyword: 'family emergency fund', volume: 2100, kd: 16, intent: 'informational', category: 'family', isLongTail: true },
      { keyword: 'personal fundraiser ideas', volume: 1600, kd: 10, intent: 'informational', category: 'family', isLongTail: true },
      { keyword: 'single parent fundraiser', volume: 480, kd: 4, intent: 'informational', category: 'family', isLongTail: true },
    ],
  },
  {
    category: 'faith',
    label: 'Faith & Religious',
    keywords: [
      { keyword: 'church fundraiser ideas', volume: 4400, kd: 18, intent: 'informational', category: 'faith', isLongTail: false },
      { keyword: 'mission trip fundraising', volume: 2400, kd: 12, intent: 'informational', category: 'faith', isLongTail: true },
      { keyword: 'faith-based fundraiser', volume: 720, kd: 6, intent: 'informational', category: 'faith', isLongTail: true },
      { keyword: 'religious charity fundraiser', volume: 590, kd: 5, intent: 'informational', category: 'faith', isLongTail: true },
    ],
  },
  {
    category: 'environment',
    label: 'Environment & Climate',
    keywords: [
      { keyword: 'environmental fundraiser ideas', volume: 880, kd: 8, intent: 'informational', category: 'environment', isLongTail: true },
      { keyword: 'climate change fundraiser', volume: 590, kd: 6, intent: 'informational', category: 'environment', isLongTail: true },
      { keyword: 'conservation fundraising', volume: 720, kd: 10, intent: 'informational', category: 'environment', isLongTail: true },
      { keyword: 'community cleanup fundraiser', volume: 480, kd: 4, intent: 'informational', category: 'environment', isLongTail: true },
    ],
  },
  {
    category: 'sports',
    label: 'Sports & Athletics',
    keywords: [
      { keyword: 'sports team fundraiser', volume: 3200, kd: 14, intent: 'informational', category: 'sports', isLongTail: false },
      { keyword: 'youth sports fundraising ideas', volume: 1900, kd: 10, intent: 'informational', category: 'sports', isLongTail: true },
      { keyword: 'athlete medical fund', volume: 480, kd: 4, intent: 'informational', category: 'sports', isLongTail: true },
      { keyword: 'sports injury fundraiser', volume: 590, kd: 5, intent: 'informational', category: 'sports', isLongTail: true },
    ],
  },
  {
    category: 'creative',
    label: 'Creative & Arts',
    keywords: [
      { keyword: 'art project fundraiser', volume: 720, kd: 6, intent: 'informational', category: 'creative', isLongTail: true },
      { keyword: 'creative fundraising ideas', volume: 2400, kd: 12, intent: 'informational', category: 'creative', isLongTail: true },
      { keyword: 'music fundraiser ideas', volume: 1300, kd: 8, intent: 'informational', category: 'creative', isLongTail: true },
    ],
  },
];

/**
 * Get all keywords for a specific category
 */
export function getKeywordsByCategory(category: string): KeywordEntry[] {
  const cluster = KEYWORD_BANK.find((c) => c.category === category);
  return cluster?.keywords ?? [];
}

/**
 * Get low-competition long-tail keywords (KD < 15) for a category
 */
export function getLowCompetitionKeywords(category: string): KeywordEntry[] {
  return getKeywordsByCategory(category).filter(
    (k) => k.kd < 15 && k.isLongTail,
  );
}

/**
 * Get all unique categories from the keyword bank
 */
export function getKeywordCategories(): string[] {
  return KEYWORD_BANK.map((c) => c.category);
}

/**
 * Get a random unused keyword for a category, avoiding recently used ones
 */
export function selectKeywordForTopic(
  category: string,
  usedKeywords: string[],
): KeywordEntry | null {
  const available = getKeywordsByCategory(category).filter(
    (k) => !usedKeywords.includes(k.keyword),
  );
  if (available.length === 0) return null;

  // Prefer low-KD, high-volume keywords
  const sorted = [...available].sort(
    (a, b) => (b.volume / (b.kd + 1)) - (a.volume / (a.kd + 1)),
  );
  return sorted[0];
}

