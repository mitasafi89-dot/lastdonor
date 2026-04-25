/**
 * AI prompt for classifying Reddit posts into blog topic candidates.
 *
 * Given a batch of Reddit posts, the AI extracts:
 *  - A search-engine-friendly keyword phrase (what someone would Google)
 *  - Cause category (mapped to campaignCategoryEnum)
 *  - Sentiment: complaint, compliment, question, or discussion
 *  - Search intent
 *  - Relevance score (0-100) for LastDonor's mission
 *  - Blog content angle (how to turn this into a useful article)
 */

import type { CampaignCategory } from '@/types';

export interface RedditPostInput {
  /** Subreddit name without r/ prefix */
  subreddit: string;
  title: string;
  /** First 500 chars of selftext (body), empty for link posts */
  selftext: string;
  score: number;
  numComments: number;
  flair: string | null;
}

export interface ClassifiedRedditPost {
  /** 0-based index into the input array */
  index: number;
  /** SEO keyword phrase someone would search on Google (3-8 words, lowercase) */
  keyword: string;
  /** Best matching cause category */
  category: CampaignCategory;
  /** Emotional tone of the original post */
  sentiment: 'complaint' | 'compliment' | 'question' | 'discussion';
  /** Search intent of someone who would Google this keyword */
  searchIntent: 'informational' | 'transactional' | 'commercial';
  /** 0-100: how relevant this is to LastDonor's mission of verified charitable fundraising */
  relevanceScore: number;
  /** One-sentence description of the blog article angle */
  blogAngle: string;
  /** Suggested blog title (50-80 chars) */
  suggestedTitle: string;
}

export interface ClassifyRedditOutput {
  posts: ClassifiedRedditPost[];
}

const VALID_CATEGORIES = [
  'medical', 'disaster', 'military', 'veterans', 'memorial',
  'first-responders', 'community', 'essential-needs', 'emergency',
  'charity', 'education', 'animal', 'environment', 'business',
  'competition', 'creative', 'event', 'faith', 'family',
  'sports', 'travel', 'volunteer', 'wishes',
] as const;

export function buildClassifyRedditPostsPrompt(posts: RedditPostInput[]) {
  const systemPrompt = `You are an SEO content strategist for LastDonor.org, a reviewed crowdfunding platform for charitable and personal causes.

Your job: analyze Reddit posts and extract blog topic opportunities. Each post represents real human need, gratitude, or discussion that can inspire valuable content.

PLATFORM CATEGORIES (use exactly these values):
${VALID_CATEGORIES.join(', ')}

CATEGORY MAPPING GUIDE:
- medical: Health crises, medical bills, surgery, chronic illness, disability, mental health
- disaster: Natural disasters, house fires, floods, hurricanes, tornadoes, displacement
- memorial: Funeral costs, burial expenses, death of a loved one, bereavement
- military: Active duty hardship, deployment, military family needs
- veterans: Veteran homelessness, VA issues, veteran mental health, transition struggles
- first-responders: Police, firefighters, EMT injuries or death in line of duty
- community: Crime victims, domestic violence, accident recovery, neighborhood crises
- essential-needs: Housing, rent, utilities, food insecurity, job loss
- emergency: Urgent financial crisis, sudden job loss, unexpected expenses
- education: Tuition, student debt, school supplies, scholarship needs
- animal: Vet bills, pet surgery, animal rescue
- family: Single parent struggles, childcare, family reunification
- faith: Religious community needs, mission trips, church crises
- charity: General charitable giving, philanthropy, volunteer project funding

SENTIMENT CLASSIFICATION:
- complaint: Expresses frustration, hardship, crisis, a problem needing help, desperation
- compliment: Expresses gratitude, success, thanks, positive outcome, sharing good news
- question: Asks for advice, information, or guidance about a situation
- discussion: General conversation, debate, sharing information or perspectives

KEYWORD EXTRACTION RULES:
- Extract 3-8 word phrases that a real person would type into Google
- Use lowercase, natural language (not marketing speak)
- For complaints: "how to pay for [specific need]", "what to do when [crisis]", "help with [problem]"
- For compliments: "fundraising success stories [topic]", "how to raise money for [cause]", "best way to fundraise for [need]"
- For questions: Use the question itself refined into a search query
- For discussions: Extract the core informational query
- NEVER use branded terms, subreddit names, or Reddit-specific language in keywords

RELEVANCE SCORING (0-100):
90-100: Directly about crowdfunding, fundraising, or charitable giving for verified needs
75-89: About a specific crisis/need where crowdfunding is a natural solution
60-74: Related to financial hardship or charitable giving broadly
40-59: Tangentially related (general finance, policy, etc.)
0-39: Irrelevant to charitable fundraising

SKIP posts where relevanceScore < 55. Only include posts with relevance >= 55 in your output.

BLOG ANGLE: Describe in one sentence what useful article this should become. Think about what would genuinely help the reader (the person in crisis OR the person who wants to help).

SUGGESTED TITLE RULES:
- 50-80 characters
- Include the primary keyword naturally
- NEVER use em dashes
- NEVER use "Unlocking", "Navigating", "Leveraging", "In Today's World"
- Use direct, warm language: "How to", "What to Do When", "A Guide to", "Why", "The Real Cost of"
- For compliments: "How One Family...", "What Successful Fundraisers...", "Why Donors..."

Return ONLY valid JSON, no markdown fencing:
{
  "posts": [
    {
      "index": 0,
      "keyword": "how to pay for surgery without insurance",
      "category": "medical",
      "sentiment": "complaint",
      "searchIntent": "informational",
      "relevanceScore": 85,
      "blogAngle": "Step-by-step guide for patients facing unexpected surgical costs with no coverage",
      "suggestedTitle": "How to Pay for Surgery Without Insurance: A Complete Guide"
    }
  ]
}`;

  const postsText = posts
    .map(
      (p, i) =>
        `[${i}] r/${p.subreddit} | Score: ${p.score} | Comments: ${p.numComments}${p.flair ? ` | Flair: ${p.flair}` : ''}
Title: ${p.title}${p.selftext ? `\nBody preview: ${p.selftext.slice(0, 300)}` : ''}`,
    )
    .join('\n\n');

  const userPrompt = `Classify these ${posts.length} Reddit posts. Only include posts with relevanceScore >= 55.

${postsText}`;

  return { systemPrompt, userPrompt };
}
