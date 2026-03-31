'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Switch } from '@/components/ui/switch';
import { centsToDollars, dollarsToCents } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Client-side validation schema (mirrors server-side createIntentSchema)
const donationFormSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .int()
    .min(500, 'Minimum donation is $5.00')
    .max(10_000_000, 'Maximum donation is $100,000'),
  donorName: z.string().max(100).optional(),
  donorEmail: z.string().email('Enter a valid email'),
  donorLocation: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean(),
  isRecurring: z.boolean(),
});

type DonationFormValues = z.infer<typeof donationFormSchema>;

const PRESET_AMOUNTS = [2500, 5000, 10000, 25000, 50000, 100000] as const; // cents

interface DonationFormProps {
  campaignId: string;
  campaignTitle: string;
  className?: string;
  /** When true, strips card wrapper (border/bg/padding) for use inside Dialog */
  embedded?: boolean;
  /** Pre-select an amount in cents when the form mounts */
  initialAmount?: number;
  /** Start the form in a specific step (e.g. 'success' after redirect return) */
  initialStep?: 'details' | 'success';
  /** Called when a donation completes successfully */
  onDonationComplete?: () => void;
}

/* ─────────────────────────────────────────────
   Step 2 — Payment confirmation (Stripe Elements)
   ───────────────────────────────────────────── */

function PaymentStep({
  amount,
  campaignTitle,
  onSuccess,
  onBack,
}: {
  amount: number;
  campaignTitle: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setPaymentError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?donation=success`,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setPaymentError(result.error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else {
      // Payment succeeded without redirect — confirm server-side so
      // donation is recorded immediately (webhook is the durable backup)
      const piId = result.paymentIntent?.id;
      if (piId) {
        fetch('/api/v1/donations/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: piId }),
        }).catch(() => {}); // non-blocking; webhook will catch up
      }
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-5">
      <p className="text-sm font-medium text-card-foreground">
        {centsToDollars(amount)} one-time donation
      </p>

      <div className="rounded-lg border border-input bg-background p-4">
        <PaymentElement
          onReady={() => setElementReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {paymentError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-sm text-destructive">{paymentError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements || !elementReady}
        className={cn(
          'w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isProcessing ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </span>
        ) : (
          `Donate ${centsToDollars(amount)}`
        )}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Secured by Stripe
        </span>
        <span>501(c)(3) nonprofit</span>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={isProcessing}
        className="mx-auto block text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        &larr; Back
      </button>
    </form>
  );
}

/* ─────────────────────────────────────────────
   Step 3 — Success confirmation
   ───────────────────────────────────────────── */

function SuccessStep({ amount, campaignTitle }: { amount: number; campaignTitle: string }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-card-foreground">
        Thank you for your donation!
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Your <span className="font-medium text-primary">{centsToDollars(amount)}</span> donation to{' '}
        <span className="font-medium">{campaignTitle}</span> has been processed.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        A receipt will be emailed to you shortly.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main DonationForm — Step 1 (donor info + amount)
   ───────────────────────────────────────────── */

export function DonationForm({
  campaignId,
  campaignTitle,
  className,
  embedded,
  initialAmount,
  initialStep,
  onDonationComplete,
}: DonationFormProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(() => {
    if (initialAmount && (PRESET_AMOUNTS as readonly number[]).includes(initialAmount)) return initialAmount;
    return null;
  });
  const [customAmount, setCustomAmount] = useState(() => {
    if (initialAmount && !(PRESET_AMOUNTS as readonly number[]).includes(initialAmount)) {
      return (initialAmount / 100).toString();
    }
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'details' | 'payment' | 'success'>(initialStep ?? 'details');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState(0);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DonationFormValues>({
    resolver: zodResolver(donationFormSchema),
    defaultValues: {
      amount: initialAmount ?? 0,
      donorName: '',
      donorEmail: '',
      donorLocation: '',
      message: '',
      isAnonymous: false,
      isRecurring: false,
    },
  });

  const messageValue = watch('message') ?? '';
  const isAnonymous = watch('isAnonymous');
  const isRecurring = watch('isRecurring');
  const currentAmount = watch('amount');

  const handlePresetSelect = useCallback((amountCents: number) => {
    setSelectedPreset(amountCents);
    setCustomAmount('');
    setValue('amount', amountCents, { shouldValidate: true });
  }, [setValue]);

  const handleCustomAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    setSelectedPreset(null);
    const dollars = parseFloat(val);
    if (!isNaN(dollars) && dollars > 0) {
      setValue('amount', dollarsToCents(dollars), { shouldValidate: true });
    } else {
      setValue('amount', 0, { shouldValidate: true });
    }
  }, [setValue]);

  // Listen for amount selection from ImpactTiers via CustomEvent
  useEffect(() => {
    function handleDonationAmount(e: Event) {
      const amountCents = (e as CustomEvent<number>).detail;
      const matchesPreset = (PRESET_AMOUNTS as readonly number[]).includes(amountCents);
      if (matchesPreset) {
        setSelectedPreset(amountCents);
        setCustomAmount('');
      } else {
        setSelectedPreset(null);
        setCustomAmount((amountCents / 100).toString());
      }
      setValue('amount', amountCents, { shouldValidate: true });
    }

    window.addEventListener('donation-amount', handleDonationAmount);
    return () => window.removeEventListener('donation-amount', handleDonationAmount);
  }, [setValue]);

  async function onSubmit(data: DonationFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/donations/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          amount: data.amount,
          donorName: data.donorName || undefined,
          donorEmail: data.donorEmail,
          donorLocation: data.donorLocation || undefined,
          message: data.message || undefined,
          isAnonymous: data.isAnonymous,
          isRecurring: data.isRecurring,
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        const { toast } = await import('sonner');
        toast.error(json.error?.message || 'Something went wrong. Please try again.');
        return;
      }

      setClientSecret(json.data.clientSecret);
      setConfirmedAmount(data.amount);
      setStep('payment');
    } catch {
      const { toast } = await import('sonner');
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Wrapper container — embedded mode strips card chrome for page use
  const wrapperClass = embedded
    ? cn('space-y-5', className)
    : cn('space-y-5 rounded-xl border border-border bg-card p-6', className);

  /* ── Success state ── */
  if (step === 'success') {
    return (
      <div className={wrapperClass}>
        <SuccessStep amount={confirmedAmount} campaignTitle={campaignTitle} />
      </div>
    );
  }

  /* ── Payment state (Stripe Elements) ── */
  if (step === 'payment' && clientSecret) {
    return (
      <div className={wrapperClass}>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#0F766E',
                borderRadius: '8px',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSizeBase: '15px',
                spacingUnit: '4px',
              },
            },
          }}
        >
          <PaymentStep
            amount={confirmedAmount}
            campaignTitle={campaignTitle}
            onSuccess={() => {
              setStep('success');
              onDonationComplete?.();
            }}
            onBack={() => {
              setStep('details');
              setClientSecret(null);
            }}
          />
        </Elements>
      </div>
    );
  }

  /* ── Details form (Step 1) ── */
  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit)}
      className={wrapperClass}
      noValidate
    >
      {!embedded && (
        <h3 className="font-display text-lg font-semibold text-card-foreground">
          Make a Donation
        </h3>
      )}

      {/* Frequency toggle — Give Once / Monthly */}
      <div className="flex rounded-full border border-border bg-muted/50 p-1" role="radiogroup" aria-label="Donation frequency">
        <button
          type="button"
          role="radio"
          aria-checked={!isRecurring}
          onClick={() => setValue('isRecurring', false)}
          className={cn(
            'flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors',
            !isRecurring
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-card-foreground',
          )}
        >
          Give Once
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isRecurring}
          onClick={() => setValue('isRecurring', true)}
          className={cn(
            'flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-colors',
            isRecurring
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-card-foreground',
          )}
        >
          Monthly
        </button>
      </div>

      {/* Preset amounts */}
      <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Donation amount">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            role="radio"
            aria-checked={selectedPreset === amount}
            onClick={() => handlePresetSelect(amount)}
            className={cn(
              'rounded-lg border py-3 text-center text-base font-semibold transition-colors',
              selectedPreset === amount
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-card-foreground hover:border-primary/40 hover:bg-muted/50',
            )}
          >
            {centsToDollars(amount)}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div>
        <label htmlFor="custom-amount" className="block text-sm font-medium text-muted-foreground">
          Custom amount
        </label>
        <div className="relative mt-1.5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-medium text-muted-foreground">
            $
          </span>
          <input
            id="custom-amount"
            type="number"
            min="5"
            max="100000"
            step="1"
            placeholder="0.00"
            value={customAmount}
            onChange={handleCustomAmountChange}
            className="w-full rounded-lg border border-input bg-background py-3 pl-8 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-describedby={errors.amount ? 'amount-error' : undefined}
          />
        </div>
        {errors.amount && (
          <p id="amount-error" className="mt-1 text-sm text-destructive" role="alert">
            {errors.amount.message}
          </p>
        )}
      </div>

      {/* Donor email — always visible (required) */}
      <div>
        <label htmlFor="donor-email" className="block text-sm font-medium text-muted-foreground">
          Email address
        </label>
        <input
          id="donor-email"
          type="email"
          {...register('donorEmail')}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-describedby={errors.donorEmail ? 'email-error' : undefined}
        />
        {errors.donorEmail && (
          <p id="email-error" className="mt-1 text-sm text-destructive" role="alert">
            {errors.donorEmail.message}
          </p>
        )}
      </div>

      {/* Collapsible donation options */}
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-card-foreground hover:bg-muted/50 transition-colors"
          aria-expanded={optionsOpen}
          aria-controls="donation-options"
        >
          Add a message or dedicate your gift
          <svg
            className={cn('h-4 w-4 text-muted-foreground transition-transform', optionsOpen && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {optionsOpen && (
          <div id="donation-options" className="space-y-4 border-t border-border px-4 pb-4 pt-3">
            {/* Donor name (optional) */}
            <div>
              <label htmlFor="donor-name" className="block text-sm font-medium text-card-foreground">
                Your name <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="donor-name"
                type="text"
                {...register('donorName')}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            {/* Donor location (optional) */}
            <div>
              <label htmlFor="donor-location" className="block text-sm font-medium text-card-foreground">
                Location <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="donor-location"
                type="text"
                placeholder="City, State"
                {...register('donorLocation')}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            {/* Message (optional) */}
            <div>
              <label htmlFor="donor-message" className="block text-sm font-medium text-card-foreground">
                Message <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="donor-message"
                rows={3}
                maxLength={500}
                {...register('message')}
                className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                aria-describedby="message-counter"
              />
              <p id="message-counter" className="mt-1 text-right text-xs text-muted-foreground">
                {messageValue.length}/500
              </p>
            </div>

            {/* Anonymous toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="anonymous-toggle" className="text-sm text-card-foreground">
                Donate anonymously
              </label>
              <Switch
                id="anonymous-toggle"
                checked={isAnonymous}
                onCheckedChange={(checked) => setValue('isAnonymous', checked)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit — prominent CTA */}
      <button
        type="submit"
        disabled={isSubmitting || currentAmount < 500}
        className={cn(
          'w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isSubmitting ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </span>
        ) : currentAmount >= 500 ? (
          `Donate ${centsToDollars(currentAmount)}`
        ) : (
          'Donate'
        )}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          Secured by Stripe
        </span>
        <span>501(c)(3) nonprofit</span>
        <span>100% goes to the cause</span>
      </div>
    </form>
  );
}

