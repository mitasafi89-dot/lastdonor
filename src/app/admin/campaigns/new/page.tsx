import { CampaignEditor } from '@/components/admin/CampaignEditor';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Campaign — Admin — LastDonor.org',
  robots: { index: false },
};

export default function NewCampaignPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Create Campaign</h1>
      <p className="mt-1 text-sm text-muted-foreground">Fill in the details to launch a new campaign.</p>
      <div className="mt-6">
        <CampaignEditor mode="create" />
      </div>
    </div>
  );
}
