export type GenerateNewsletterInput = {
  featuredCampaign: {
    title: string;
    subjectName: string;
    category: string;
    raisedAmount: number;
    goalAmount: number;
    slug: string;
  };
  recentImpact?: {
    subjectName: string;
    raisedAmount: number;
    donorCount: number;
  };
  subscriberCount: number;
};

export function buildGenerateNewsletterPrompt(input: GenerateNewsletterInput) {
  const systemPrompt = `You write weekly email newsletters for a nonprofit fundraising platform called LastDonor.org. The newsletter has 3 sections and should be ~300 words total. Write in a warm, personal, conversational tone. Return ONLY valid JSON, no markdown fencing.

Return JSON:
{
  "subject": string (email subject line, compelling, ~50 chars),
  "preheader": string (email preview text, ~100 chars),
  "featuredHtml": string (featured campaign section, ~150 words, HTML formatted),
  "impactHtml": string (impact update section, ~90 words, HTML formatted),
  "contextHtml": string (one thing to know section, ~60 words, HTML formatted)
}`;

  const campaign = input.featuredCampaign;
  const raisedDollars = (campaign.raisedAmount / 100).toLocaleString();
  const goalDollars = (campaign.goalAmount / 100).toLocaleString();
  const percentage = Math.floor((campaign.raisedAmount / campaign.goalAmount) * 100);

  let impactSection = 'No recent impact report available. Write a brief section about how LastDonor.org works and why every donation matters.';
  if (input.recentImpact) {
    const impactRaised = (input.recentImpact.raisedAmount / 100).toLocaleString();
    impactSection = `Recent completed campaign: ${input.recentImpact.subjectName} raised $${impactRaised} from ${input.recentImpact.donorCount} donors.`;
  }

  const userPrompt = `FEATURED CAMPAIGN:
- Title: ${campaign.title}
- Subject: ${campaign.subjectName}
- Category: ${campaign.category}
- Raised: $${raisedDollars} of $${goalDollars} (${percentage}%)
- URL: https://lastdonor.org/campaigns/${campaign.slug}

IMPACT UPDATE:
${impactSection}

CONTEXT:
- Total newsletter subscribers: ${input.subscriberCount}

Write 3 sections:
1. Featured campaign (50% of content) - Drive donations to this campaign
2. Impact update (30%) - Highlight what donations accomplished
3. One thing to know (20%) - A brief, relevant thought about giving or the cause`;

  return { systemPrompt, userPrompt };
}
