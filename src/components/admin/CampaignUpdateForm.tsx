'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CampaignUpdateFormProps {
  campaignId: string;
}

export function CampaignUpdateForm({ campaignId }: CampaignUpdateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          bodyHtml: bodyHtml.trim(),
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.code === 'VALIDATION_ERROR' ? (data.error?.message ?? 'Failed to create update') : 'Failed to create update');
      }

      router.push(`/admin/campaigns/${campaignId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create update');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-100 focus:border-primary focus:ring-2 focus:ring-ring"
              placeholder="e.g. Campaign reaches 50% of goal!"
            />
          </div>

          <div>
            <label htmlFor="bodyHtml" className="block text-sm font-medium text-foreground">
              Body (HTML)
            </label>
            <textarea
              id="bodyHtml"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              required
              rows={8}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-100 focus:border-primary focus:ring-2 focus:ring-ring"
              placeholder="<p>Write your update here…</p>"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Supports HTML. Content will be sanitized before saving.
            </p>
          </div>

          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-foreground">
              Image URL (optional)
            </label>
            <input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-100 focus:border-primary focus:ring-2 focus:ring-ring"
              placeholder="https://…"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-100 hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Posting…' : 'Post Update'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors duration-100 hover:bg-muted/60"
            >
              Cancel
            </button>
          </div>
        </form>
    </div>
  );
}
