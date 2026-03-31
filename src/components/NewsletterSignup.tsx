'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { subscribeSchema } from '@/lib/validators/newsletter';
import type { SubscribeInput } from '@/lib/validators/newsletter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { EnvelopeIcon } from '@heroicons/react/24/outline';

interface NewsletterSignupProps {
  source: 'homepage' | 'campaign' | 'blog' | 'footer';
  className?: string;
}

export function NewsletterSignup({ source, className }: NewsletterSignupProps) {
  const [subscribed, setSubscribed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SubscribeInput>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { source },
  });

  async function onSubmit(data: SubscribeInput) {
    const res = await fetch('/api/v1/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error?.message ?? 'Subscription failed');
      return;
    }

    setSubscribed(true);
    toast.success('Welcome! Check your inbox for a confirmation.');
    reset();
  }

  if (subscribed) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-brand-teal">
          <EnvelopeIcon className="h-5 w-5" />
          <p className="font-medium">You&apos;re subscribed! Check your inbox.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={className}>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          aria-label="Email address"
          {...register('email')}
          className="max-w-xs"
        />
        <input type="hidden" {...register('source')} />
        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? 'Subscribing…' : 'Subscribe'}
        </Button>
      </div>
      {errors.email && (
        <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
      )}
    </form>
  );
}
