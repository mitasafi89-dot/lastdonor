'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/dates';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/utils/sanitize';

interface Update {
  id: string;
  title: string;
  bodyHtml: string | null;
  updateType: string | null;
  createdAt: string;
}

export function CampaignUpdatesClient({
  campaignId,
  updates,
  canPost,
}: {
  campaignId: string;
  updates: Update[];
  canPost: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [posting, setPosting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);

    try {
      const res = await fetch(`/api/v1/user-campaigns/${campaignId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.code === 'VALIDATION_ERROR' ? (data?.error?.message ?? 'Failed to post update') : 'Failed to post update');
      }

      toast.success('Update posted successfully.');
      setTitle('');
      setBody('');
      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post update');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-6">
      {canPost && (
        <div className="mb-6">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              + Post Update
            </button>
          ) : (
            <Card>
              <CardContent className="py-4">
                <form onSubmit={handlePost} className="space-y-4">
                  <div>
                    <label htmlFor="update-title" className="text-sm font-medium text-foreground">
                      Title <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="update-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                      minLength={3}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="update-body" className="text-sm font-medium text-foreground">
                      Update <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      id="update-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                      minLength={10}
                      maxLength={5000}
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={posting}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {posting ? 'Posting...' : 'Post Update'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Updates List */}
      {updates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No updates have been posted yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {updates.map((upd) => (
            <Card key={upd.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{upd.title}</p>
                    <Badge variant="outline" className="mt-1 text-xs">{upd.updateType}</Badge>
                    {upd.bodyHtml && (
                      <div
                        className="prose prose-sm mt-3 max-w-none text-muted-foreground dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(upd.bodyHtml) }}
                      />
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(upd.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
