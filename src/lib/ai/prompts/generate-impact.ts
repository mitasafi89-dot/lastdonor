import type { CampaignCategory } from '@/types';

export type GenerateImpactInput = {
  subjectName: string;
  event: string;
  category: CampaignCategory;
  goalAmount: number;
  raisedAmount: number;
  donorCount: number;
  lastDonorName?: string;
};

export function buildGenerateImpactPrompt(input: GenerateImpactInput) {
  const systemPrompt = `You write impact reports for a nonprofit fundraising platform. Write a 3-paragraph report for a completed campaign. Be factual and warm. Use phrases like "funds are being directed toward" rather than confirming specific payments. Return ONLY plain text paragraphs separated by blank lines, no formatting.`;

  const userPrompt = `Campaign: ${input.subjectName} - ${input.event}
Category: ${input.category}
Goal: $${(input.goalAmount / 100).toLocaleString()}
Raised: $${(input.raisedAmount / 100).toLocaleString()}
Total Donors: ${input.donorCount}
${input.lastDonorName ? `Last Donor: ${input.lastDonorName}` : ''}

Write a 3-paragraph impact report:
1. Recap: Who this was about, what happened, how much was raised by how many donors
2. Disbursement: How the funds will be/were used (estimate based on the "${input.category}" category - be realistic)
3. Thank you: Thank all donors, and if a Last Donor name is provided, mention them by name as the person who completed this campaign`;

  return { systemPrompt, userPrompt };
}
