import type { Metadata } from 'next';
import { ShareYourStoryForm } from './ShareYourStoryForm';

export const metadata: Metadata = {
  title: 'Start a Campaign',
  description:
    'Know someone who needs help? Start a campaign in minutes. Your campaign goes live immediately. No setup fees, no waiting.',
  openGraph: {
    title: 'Start a Campaign | LastDonor.org',
    description: 'Start a campaign in minutes. Your campaign goes live immediately and you can start sharing it right away.',
    images: [
      {
        url: '/api/v1/og/page?title=Start+a+Campaign&subtitle=Share+your+story.+We+verify+it.+Your+community+funds+it.',
        width: 1200,
        height: 630,
        alt: 'Start a Campaign on LastDonor.org',
      },
    ],
  },
};

export default function ShareYourStoryPage() {
  return <ShareYourStoryForm />;
}
