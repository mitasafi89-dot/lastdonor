'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '@/lib/validators/user';
import type { UpdateProfileInput } from '@/lib/validators/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { toast } from 'sonner';
import { signOut } from 'next-auth/react';

interface ProfileData {
  name: string;
  email: string;
  location: string | null;
  avatarUrl: string | null;
}

interface ProfileFormProps {
  profile: ProfileData;
}

function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: profile.name,
      location: profile.location ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
    },
  });

  async function onSubmit(data: UpdateProfileInput) {
    const res = await fetch('/api/v1/users/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error?.message ?? 'Failed to update profile');
      return;
    }

    toast.success('Profile updated');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input id="location" placeholder="City, State" {...register('location')} />
        {errors.location && (
          <p className="mt-1 text-sm text-destructive">{errors.location.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="avatarUrl">Avatar URL</Label>
        <Input id="avatarUrl" type="url" placeholder="https://..." {...register('avatarUrl')} />
        {errors.avatarUrl && (
          <p className="mt-1 text-sm text-destructive">{errors.avatarUrl.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/v1/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });

      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error?.message ?? 'Failed to delete account');
        return;
      }

      toast.success('Account deleted');
      await signOut({ callbackUrl: '/' });
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Delete Account</CardTitle>
        <CardDescription>
          Permanently delete your account and anonymize all donation data. This action cannot be
          undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete My Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This will permanently delete your account and anonymize all your donation records.
                You will not be able to recover your data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete My Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function ProfilePageClient({ profile }: ProfileFormProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs />

      <h1 className="font-display text-3xl font-bold text-foreground">Profile</h1>
      <p className="mt-1 text-muted-foreground">{profile.email}</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name, location, and avatar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <div className="mt-8">
        <DeleteAccountSection />
      </div>
    </main>
  );
}
