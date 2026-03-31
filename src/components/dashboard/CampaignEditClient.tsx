'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface CampaignData {
  id: string;
  title: string;
  story: string;
  category: string;
  heroImageUrl: string;
  photoCredit: string;
  subjectHometown: string;
  fundUsagePlan: string;
}

const CATEGORIES = [
  'medical', 'disaster', 'military', 'veterans', 'memorial',
  'first-responders', 'community', 'essential-needs', 'emergency',
  'charity', 'education', 'animal', 'environment', 'business',
  'competition', 'creative', 'event', 'faith', 'family',
  'sports', 'travel', 'volunteer', 'wishes',
] as const;

export function CampaignEditClient({ campaign }: { campaign: CampaignData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: campaign.title,
    story: campaign.story,
    category: campaign.category,
    heroImageUrl: campaign.heroImageUrl,
    photoCredit: campaign.photoCredit,
    subjectHometown: campaign.subjectHometown,
    fundUsagePlan: campaign.fundUsagePlan,
  });

  const handleChange = useCallback(
    (field: string, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Only send changed fields
      const updates: Record<string, string> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value !== (campaign as unknown as Record<string, string>)[key]) {
          updates[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save.');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/v1/user-campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Failed to save changes');
      }

      toast.success('Campaign updated successfully.');
      router.push(`/dashboard/campaigns/${campaign.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-6 py-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="text-sm font-medium text-foreground">
              Campaign Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              minLength={20}
              maxLength={120}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{form.title.length}/120 characters</p>
          </div>

          {/* Story */}
          <div>
            <label htmlFor="story" className="text-sm font-medium text-foreground">
              Story <span className="text-destructive">*</span>
            </label>
            <textarea
              id="story"
              value={form.story}
              onChange={(e) => handleChange('story', e.target.value)}
              rows={10}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              minLength={200}
              maxLength={10000}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{form.story.length}/10,000 characters</p>
          </div>

          {/* Fund Usage Plan */}
          <div>
            <label htmlFor="fundUsagePlan" className="text-sm font-medium text-foreground">
              How Funds Will Be Used <span className="text-destructive">*</span>
            </label>
            <textarea
              id="fundUsagePlan"
              value={form.fundUsagePlan}
              onChange={(e) => handleChange('fundUsagePlan', e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              minLength={100}
              maxLength={3000}
              required
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="text-sm font-medium text-foreground">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize outline-none transition-colors focus:border-primary"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="capitalize">{cat}</option>
              ))}
            </select>
          </div>

          {/* Hero Image URL */}
          <div>
            <label htmlFor="heroImageUrl" className="text-sm font-medium text-foreground">
              Campaign Image URL <span className="text-destructive">*</span>
            </label>
            <input
              id="heroImageUrl"
              type="url"
              value={form.heroImageUrl}
              onChange={(e) => handleChange('heroImageUrl', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              required
            />
          </div>

          {/* Photo Credit */}
          <div>
            <label htmlFor="photoCredit" className="text-sm font-medium text-foreground">Photo Credit</label>
            <input
              id="photoCredit"
              type="text"
              value={form.photoCredit}
              onChange={(e) => handleChange('photoCredit', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              maxLength={200}
            />
          </div>

          {/* Subject Hometown */}
          <div>
            <label htmlFor="subjectHometown" className="text-sm font-medium text-foreground">Location</label>
            <input
              id="subjectHometown"
              type="text"
              value={form.subjectHometown}
              onChange={(e) => handleChange('subjectHometown', e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              maxLength={200}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
