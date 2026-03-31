'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { toast } from 'sonner';
import {
  BellIcon,
  ShieldCheckIcon,
  EyeIcon,
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { UserPreferences } from '@/lib/validators/user';

const DEFAULT_PREFERENCES: UserPreferences = {
  emailDonationReceipts: true,
  emailCampaignUpdates: true,
  emailNewCampaigns: false,
  emailNewsletter: false,
  showProfilePublicly: true,
  showDonationsPublicly: false,
  showBadgesPublicly: true,
};

interface SettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
}

function SettingRow({ label, description, checked, onCheckedChange, id }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function SettingsPageClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/v1/users/settings');
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok && json.data) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...json.data });
        }
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const savePreferences = useCallback(async (updated: UserPreferences) => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/users/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? 'Failed to save settings');
        return;
      }
      toast.success('Settings saved');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, []);

  function updatePref(key: keyof UserPreferences, value: boolean) {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    savePreferences(updated);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">{session?.user?.email}</p>
        </div>
        {saving && (
          <Badge variant="secondary" className="animate-pulse">Saving…</Badge>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <Squares2X2Icon className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <UserCircleIcon className="h-3.5 w-3.5" />
          Profile
        </Link>
      </div>

      {/* Email Notifications */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BellIcon className="h-5 w-5 text-brand-teal" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Choose which emails you&apos;d like to receive from LastDonor.org
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            id="emailDonationReceipts"
            label="Donation receipts"
            description="Receive an email confirmation after each donation with your tax-deductible receipt"
            checked={preferences.emailDonationReceipts ?? true}
            onCheckedChange={(v) => updatePref('emailDonationReceipts', v)}
          />
          <SettingRow
            id="emailCampaignUpdates"
            label="Campaign updates"
            description="Get notified when campaigns you've donated to post updates or reach milestones"
            checked={preferences.emailCampaignUpdates ?? true}
            onCheckedChange={(v) => updatePref('emailCampaignUpdates', v)}
          />
          <SettingRow
            id="emailNewCampaigns"
            label="New campaign alerts"
            description="Be the first to know when new verified campaigns go live"
            checked={preferences.emailNewCampaigns ?? false}
            onCheckedChange={(v) => updatePref('emailNewCampaigns', v)}
          />
          <SettingRow
            id="emailNewsletter"
            label="Monthly newsletter"
            description="Impact stories, platform updates, and community highlights"
            checked={preferences.emailNewsletter ?? false}
            onCheckedChange={(v) => updatePref('emailNewsletter', v)}
          />
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <EyeIcon className="h-5 w-5 text-brand-teal" />
            <CardTitle>Privacy</CardTitle>
          </div>
          <CardDescription>
            Control what other donors can see about you
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            id="showProfilePublicly"
            label="Public profile"
            description="Allow your name and avatar to appear on the Last Donor Wall and campaign pages"
            checked={preferences.showProfilePublicly ?? true}
            onCheckedChange={(v) => updatePref('showProfilePublicly', v)}
          />
          <SettingRow
            id="showDonationsPublicly"
            label="Show donation amounts"
            description="Display your donation amounts alongside your name on campaign pages"
            checked={preferences.showDonationsPublicly ?? false}
            onCheckedChange={(v) => updatePref('showDonationsPublicly', v)}
          />
          <SettingRow
            id="showBadgesPublicly"
            label="Show badges"
            description="Display your earned badges (Last Donor, First Believer, etc.) on your public profile"
            checked={preferences.showBadgesPublicly ?? true}
            onCheckedChange={(v) => updatePref('showBadgesPublicly', v)}
          />
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-brand-teal" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>
            Manage your account access and data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Sign out</p>
              <p className="text-xs text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <ArrowRightStartOnRectangleIcon className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Edit profile</p>
              <p className="text-xs text-muted-foreground">
                Update your name, location, and avatar
              </p>
            </div>
            <Link href="/profile" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <UserCircleIcon className="mr-1.5 h-4 w-4" />
              Edit
            </Link>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">Delete account</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and anonymize donation data
              </p>
            </div>
            <Link href="/profile" className={buttonVariants({ variant: 'destructive', size: 'sm' })}>
              Manage
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
