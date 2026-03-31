'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PhotoUpload } from '@/components/PhotoUpload';
import {
  Heart,
  Waves,
  Shield,
  Star,
  Flame,
  Siren,
  Users,
  Home,
  AlertTriangle,
  HandHeart,
  GraduationCap,
  PawPrint,
  Leaf,
  Briefcase,
  Trophy,
  Palette,
  PartyPopper,
  HandHelping,
  Baby,
  Dribbble,
  Plane,
  UserCheck,
  Sparkles,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  'The Basics',
  'Tell Their Story',
  'Set Your Goal',
  'Review & Submit',
] as const;

const CATEGORIES: ReadonlyArray<{ value: string; label: string; icon: typeof Heart }> = [
  { value: 'medical', label: 'Medical', icon: Heart },
  { value: 'disaster', label: 'Disaster Relief', icon: Waves },
  { value: 'military', label: 'Military', icon: Shield },
  { value: 'veterans', label: 'Veterans', icon: Star },
  { value: 'memorial', label: 'Memorial', icon: Flame },
  { value: 'first-responders', label: 'First Responders', icon: Siren },
  { value: 'community', label: 'Community', icon: Users },
  { value: 'essential-needs', label: 'Essential Needs', icon: Home },
  { value: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { value: 'charity', label: 'Charity', icon: HandHeart },
  { value: 'education', label: 'Education', icon: GraduationCap },
  { value: 'animal', label: 'Animal', icon: PawPrint },
  { value: 'environment', label: 'Environment', icon: Leaf },
  { value: 'business', label: 'Business', icon: Briefcase },
  { value: 'competition', label: 'Competition', icon: Trophy },
  { value: 'creative', label: 'Creative', icon: Palette },
  { value: 'event', label: 'Event', icon: PartyPopper },
  { value: 'faith', label: 'Faith', icon: HandHelping },
  { value: 'family', label: 'Family', icon: Baby },
  { value: 'sports', label: 'Sports', icon: Dribbble },
  { value: 'travel', label: 'Travel', icon: Plane },
  { value: 'volunteer', label: 'Volunteer', icon: UserCheck },
  { value: 'wishes', label: 'Wishes', icon: Sparkles },
];

const RELATIONS = [
  { value: 'self', label: 'Myself' },
  { value: 'family', label: 'A family member' },
  { value: 'friend', label: 'A friend' },
  { value: 'colleague', label: 'A colleague' },
  { value: 'community_member', label: 'A community member' },
  { value: 'organization', label: 'An organization' },
  { value: 'other', label: 'Someone else' },
] as const;

const DRAFT_KEY = 'lastdonor_campaign_draft';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MilestoneFormData {
  title: string;
  description: string;
  fundPercentage: string;
}

interface FormData {
  // Step 0: The Basics
  subjectName: string;
  subjectHometown: string;
  beneficiaryRelation: string;
  category: string;
  beneficiaryConsent: boolean;
  // Step 1: Tell Their Story
  title: string;
  story: string;
  // Step 2: Set Your Goal & Fund Release Plan
  goalAmount: string;
  milestones: MilestoneFormData[];
  // Step 3: Review & Submit (photo + legal)
  heroImageUrl: string;
  photoCredit: string;
  agreedToTerms: boolean;
  confirmedTruthful: boolean;
}

type FormErrors = Partial<Record<string, string>>;

const INITIAL: FormData = {
  subjectName: '',
  subjectHometown: '',
  beneficiaryRelation: '',
  category: '',
  beneficiaryConsent: false,
  title: '',
  story: '',
  goalAmount: '',
  milestones: [
    { title: '', description: '', fundPercentage: '30' },
    { title: '', description: '', fundPercentage: '40' },
    { title: '', description: '', fundPercentage: '30' },
  ],
  heroImageUrl: '',
  photoCredit: '',
  agreedToTerms: false,
  confirmedTruthful: false,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function storyCharMessage(len: number): { text: string; color: string } {
  if (len === 0) return { text: '', color: '' };
  if (len < 200)
    return { text: `Keep going, ${200 - len} more characters needed`, color: 'text-amber-600 dark:text-amber-400' };
  if (len < 500)
    return { text: 'Good start. More detail helps donors connect.', color: 'text-teal-600 dark:text-teal-400' };
  if (len < 800)
    return { text: 'Nice work. Campaigns with detailed stories raise significantly more.', color: 'text-teal-600 dark:text-teal-400' };
  if (len < 1500)
    return { text: 'Strong story. This level of detail inspires donors to give.', color: 'text-teal-600 dark:text-teal-400' };
  return { text: 'Excellent. This is the kind of detail that makes campaigns successful.', color: 'text-teal-600 dark:text-teal-400' };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ShareYourStoryForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [showPhotoCredit, setShowPhotoCredit] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  // ── Draft persistence ──────────────────────────────────────────────────
  //
  // Persists form fields + current step to localStorage so the user's
  // progress survives page reloads and login redirects. Legal checkboxes
  // are excluded: re-checking them is a deliberate, low-effort action that
  // reinforces consent (Baymard Institute recommendation for legal fields).

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormData & { _step: number }>;
        const { _step, ...fields } = parsed;
        setForm((prev) => ({ ...prev, ...fields }));
        if (typeof _step === 'number' && _step >= 0 && _step < STEPS.length) {
          setStep(_step);
        }
        setDraftRestored(true);
        if (fields.photoCredit) setShowPhotoCredit(true);
      }
    } catch {
      // Corrupt draft, ignore
    }
  }, []);

  const saveDraft = useCallback((data: FormData, currentStep: number) => {
    try {
      const { agreedToTerms, confirmedTruthful, ...draftFields } = data;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draftFields, _step: currentStep }));
    } catch {
      // localStorage full or unavailable, acceptable degradation
    }
  }, []);

  useEffect(() => {
    if (form.subjectName || form.title || form.story) {
      saveDraft(form, step);
    }
  }, [form, step, saveDraft]);

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  // ── Form updates ───────────────────────────────────────────────────────

  function update(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === 'heroImageUrl') setImagePreviewError(false);
  }

  function updateMilestone(index: number, field: keyof MilestoneFormData, value: string) {
    setForm((prev) => {
      const milestones = prev.milestones.map((m, i) =>
        i === index ? { ...m, [field]: value } : m,
      );

      // Auto-adjust other percentages to maintain 100% total
      if (field === 'fundPercentage') {
        const newPct = parseInt(value);
        const MAX_PCTS = [40, 60, 60];
        const MIN_PCT = 10;

        if (!isNaN(newPct) && newPct >= 1 && 100 - newPct >= 2 * MIN_PCT) {
          const remaining = 100 - newPct;
          const others = [0, 1, 2].filter((j) => j !== index);
          const oldValues = others.map((j) => parseInt(prev.milestones[j].fundPercentage) || MIN_PCT);
          const oldSum = oldValues[0] + oldValues[1];

          // Distribute remaining proportionally to current ratio
          let val0: number;
          let val1: number;
          if (oldSum > 0) {
            val0 = Math.round((remaining * oldValues[0]) / oldSum);
            val1 = remaining - val0;
          } else {
            val0 = Math.round(remaining / 2);
            val1 = remaining - val0;
          }

          // Clamp to per-phase bounds and redistribute remainder
          val0 = Math.max(MIN_PCT, Math.min(MAX_PCTS[others[0]], val0));
          val1 = remaining - val0;
          val1 = Math.max(MIN_PCT, Math.min(MAX_PCTS[others[1]], val1));
          val0 = remaining - val1;

          milestones[others[0]] = { ...milestones[others[0]], fundPercentage: String(val0) };
          milestones[others[1]] = { ...milestones[others[1]], fundPercentage: String(val1) };
        }
      }

      return { ...prev, milestones };
    });
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[`m${index}_${field}`];
      if (field === 'fundPercentage') {
        delete updated.milestoneTotal;
        delete updated[`m0_fundPercentage`];
        delete updated[`m1_fundPercentage`];
        delete updated[`m2_fundPercentage`];
      }
      return updated;
    });
  }

  // ── Step validation ────────────────────────────────────────────────────
  //
  // Each step validates only its own fields. Photo is validated at step 3
  // (Review & Submit) because the upload API requires authentication, and
  // the auth gate fires at the step 2 → 3 transition. This guarantees that
  // by the time the user sees the photo upload widget, they are signed in.
  function validateStep(s: number): boolean {
    const errs: FormErrors = {};

    if (s === 0) {
      if (form.subjectName.trim().length < 2)
        errs.subjectName = 'Name must be at least 2 characters';
      if (form.subjectHometown.trim().length < 2)
        errs.subjectHometown = 'Location is required (e.g. "Austin, TX")';
      if (!form.beneficiaryRelation)
        errs.beneficiaryRelation = 'Please select your relationship';
      if (!form.category)
        errs.category = 'Please select a category';
    } else if (s === 1) {
      if (form.title.trim().length < 20)
        errs.title = `Title must be at least 20 characters (${form.title.trim().length}/20)`;
      if (form.title.trim().length > 120)
        errs.title = 'Title must be under 120 characters';
      if (form.story.trim().length < 200)
        errs.story = `Story must be at least 200 characters (${form.story.trim().length}/200)`;
    } else if (s === 2) {
      const cents = Math.round(parseFloat(form.goalAmount || '0') * 100);
      if (isNaN(cents) || cents < 5000) errs.goalAmount = 'Minimum goal is $50';
      if (cents > 5_000_000) errs.goalAmount = 'Maximum goal is $50,000';
      form.milestones.forEach((m, i) => {
        if (m.title.trim().length < 3)
          errs[`m${i}_title`] = 'Title must be at least 3 characters';
        if (m.description.trim().length < 10)
          errs[`m${i}_description`] = 'Description must be at least 10 characters';
        const pct = parseInt(m.fundPercentage);
        const maxPct = i === 0 ? 40 : 60;
        if (isNaN(pct) || pct < 10)
          errs[`m${i}_fundPercentage`] = 'Must be at least 10%';
        else if (pct > maxPct)
          errs[`m${i}_fundPercentage`] = `Phase ${i + 1} cannot exceed ${maxPct}%`;
      });
      const total = form.milestones.reduce((sum, m) => sum + (parseInt(m.fundPercentage) || 0), 0);
      if (total !== 100)
        errs.milestoneTotal = `Percentages must sum to 100% (currently ${total}%)`;
    } else if (s === 3) {
      if (!form.heroImageUrl.trim())
        errs.heroImageUrl = 'A campaign photo is required';
      if (!form.agreedToTerms)
        errs.agreedToTerms = 'You must agree to the Terms of Service';
      if (!form.confirmedTruthful)
        errs.confirmedTruthful = 'You must confirm the information is truthful';
      if (form.beneficiaryRelation && form.beneficiaryRelation !== 'self' && !form.beneficiaryConsent)
        errs.beneficiaryConsent = 'You must confirm the named person is aware of this campaign';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  //
  // Auth gate: fires when the user advances from Step 2 (Set Your Goal)
  // to Step 3 (Review & Submit). This is the last possible moment before photo
  // upload, which requires authentication. The current step is saved in the
  // draft so the user returns directly to Step 3 after signing in.

  function goNext() {
    if (!validateStep(step)) return;

    // Auth gate before Step 3: photo upload requires an authenticated session
    if (step === 2 && !session?.user) {
      saveDraft(form, 3); // save target step so user returns here after login
      router.push('/login?callbackUrl=%2Fshare-your-story');
      return;
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateStep(3)) return;

    // Safety net: should never reach here unauthenticated because of the
    // auth gate at step 2 → 3. But if session expired mid-form, handle it.
    if (!session?.user) {
      saveDraft(form, 3);
      router.push('/login?callbackUrl=%2Fshare-your-story');
      return;
    }

    setSubmitting(true);
    try {
      const goalCents = Math.round(parseFloat(form.goalAmount) * 100);

      const res = await fetch('/api/v1/user-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: form.subjectName.trim(),
          subjectHometown: form.subjectHometown.trim(),
          beneficiaryRelation: form.beneficiaryRelation,
          category: form.category,
          beneficiaryConsent: form.beneficiaryRelation === 'self' ? true : form.beneficiaryConsent,
          title: form.title.trim(),
          story: form.story.trim(),
          goalAmount: goalCents,
          milestones: form.milestones.map((m) => ({
            title: m.title.trim(),
            description: m.description.trim(),
            fundPercentage: parseInt(m.fundPercentage),
          })),
          heroImageUrl: form.heroImageUrl.trim(),
          photoCredit: form.photoCredit.trim() || undefined,
          agreedToTerms: form.agreedToTerms,
          confirmedTruthful: form.confirmedTruthful,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const { toast } = await import('sonner');
        toast.error(data.error?.message || 'Failed to create campaign');
        return;
      }

      clearDraft();

      // Redirect to congratulations page (instant-live: campaign is active now)
      if (data.data?.slug) {
        router.push(`/campaigns/${data.data.slug}/congratulations`);
        return;
      }

      // Fallback if slug not available
      setSubmitted(true);
    } catch {
      const { toast } = await import('sonner');
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
          <svg className="h-8 w-8 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Your Campaign Is Live!
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Your campaign is now live and accepting donations. Share it with
          friends and family to get your first donation!
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your email for tips on how to share your campaign effectively.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const goalDollars = form.goalAmount ? parseFloat(form.goalAmount) : 0;
  const storyLen = form.story.trim().length;
  const storyMsg = storyCharMessage(storyLen);
  const showBeneficiaryConsent = form.beneficiaryRelation && form.beneficiaryRelation !== 'self';
  const totalPct = form.milestones.reduce((sum, m) => sum + (parseInt(m.fundPercentage) || 0), 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumbs />

      <h1 className="mt-6 font-display text-3xl font-bold text-foreground">
        Start a Campaign
      </h1>
      <p className="mt-2 text-muted-foreground">
        Tell us who needs help and why. Your campaign goes live immediately so
        you can start sharing it right away.
      </p>

      {/* Draft restored notice */}
      {draftRestored && step === 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-900 dark:bg-teal-950/30">
          <p className="text-sm text-teal-800 dark:text-teal-200">
            Your previous draft has been restored.
          </p>
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL);
              clearDraft();
              setDraftRestored(false);
            }}
            className="text-sm font-medium text-teal-700 underline hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* Step indicator */}
      <nav aria-label="Campaign creation progress" className="mt-8">
        <ol className="flex items-center gap-1 sm:gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-1 sm:gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  i < step
                    ? 'bg-teal-600 text-white'
                    : i === step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
                aria-current={i === step ? 'step' : undefined}
              >
                {i < step ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`hidden text-sm sm:inline ${
                  i === step ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-4 sm:w-8 ${i < step ? 'bg-teal-600' : 'bg-border'}`} aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* ── Step 0: The Basics ─────────────────────────────────────────── */}
      <div className="mt-8">
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subjectName">Who needs help?</Label>
              <Input
                id="subjectName"
                value={form.subjectName}
                onChange={(e) => update('subjectName', e.target.value)}
                maxLength={200}
                placeholder="Their full name"
                aria-invalid={!!errors.subjectName}
                aria-describedby={errors.subjectName ? 'subjectName-error' : undefined}
              />
              {errors.subjectName && <p id="subjectName-error" className="text-sm text-red-500">{errors.subjectName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjectHometown">Their location</Label>
              <Input
                id="subjectHometown"
                value={form.subjectHometown}
                onChange={(e) => update('subjectHometown', e.target.value)}
                maxLength={200}
                placeholder="City, State (e.g. Austin, TX)"
                aria-invalid={!!errors.subjectHometown}
                aria-describedby={errors.subjectHometown ? 'subjectHometown-error' : undefined}
              />
              {errors.subjectHometown && <p id="subjectHometown-error" className="text-sm text-red-500">{errors.subjectHometown}</p>}
              <p className="text-xs text-muted-foreground">
                Donors connect more with campaigns tied to a real place.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Campaign category">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const selected = form.category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update('category', cat.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
            </div>

            <div className="space-y-3">
              <Label>Your relationship to this person</Label>
              <RadioGroup
                value={form.beneficiaryRelation}
                onValueChange={(v) => update('beneficiaryRelation', v)}
              >
                {RELATIONS.map((r) => (
                  <div className="flex items-center space-x-2" key={r.value}>
                    <RadioGroupItem value={r.value} id={`rel-${r.value}`} />
                    <Label htmlFor={`rel-${r.value}`} className="cursor-pointer font-normal">
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.beneficiaryRelation && (
                <p className="text-sm text-red-500">{errors.beneficiaryRelation}</p>
              )}
            </div>

            {/* Soft notice when raising for someone else — binding consent is in Step 3 */}
            {showBeneficiaryConsent && (
              <p className="text-xs text-muted-foreground">
                By continuing, you confirm that {form.subjectName || 'this person'} is
                aware you are creating this campaign on their behalf.
              </p>
            )}
          </div>
        )}

        {/* ── Step 1: Tell Their Story ────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Campaign title</Label>
              <p className="text-sm text-muted-foreground">
                A specific, person-focused title that tells donors exactly what this
                campaign is about.
              </p>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                maxLength={120}
                placeholder={
                  form.subjectName
                    ? `Help ${form.subjectName} with...`
                    : 'Help [Name] recover from [situation]'
                }
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'title-error' : 'title-hint'}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span id="title-hint">{form.title.trim().length} / 120 characters</span>
                {form.title.trim().length > 0 && form.title.trim().length < 20 && (
                  <span className="text-amber-500">{20 - form.title.trim().length} more needed</span>
                )}
              </div>
              {errors.title && <p id="title-error" className="text-sm text-red-500">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="story">
                Tell {form.subjectName ? `${form.subjectName}'s` : 'their'} story
              </Label>
              {/* Inline writing guidance */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Writing tips</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>Use their first name, not &ldquo;the patient&rdquo;</li>
                  <li>Include one personal detail that makes them real: their hometown, a hobby, a family role</li>
                  <li>Explain what happened in plain language, no jargon</li>
                  <li>Be specific about the gap: what do they need that they don&apos;t have?</li>
                  <li>Show strength, not helplessness. These are people, not victims</li>
                </ul>
              </div>
              <Textarea
                id="story"
                value={form.story}
                onChange={(e) => update('story', e.target.value)}
                rows={10}
                maxLength={10000}
                placeholder={
                  form.subjectName
                    ? `${form.subjectName} is from ${form.subjectHometown || '[their hometown]'}. [Share what happened and when the situation began.]\n\n[How is this affecting ${form.subjectName} and their family right now?]\n\n[Why is help needed now? What happens if the goal isn't reached?]`
                    : 'Start with their name and where they\'re from. Share what happened, how it\'s affecting them, and why they need help now.'
                }
                aria-invalid={!!errors.story}
                aria-describedby="story-counter"
              />
              <div id="story-counter" className="flex justify-between text-xs">
                <span className="text-muted-foreground">{storyLen.toLocaleString()} / 10,000 characters</span>
                {storyMsg.text && <span className={storyMsg.color}>{storyMsg.text}</span>}
              </div>
              {errors.story && <p className="text-sm text-red-500">{errors.story}</p>}
            </div>
          </div>
        )}

        {/* ── Step 2: Set Your Goal ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="goalAmount">Fundraising goal ($)</Label>
              <p className="text-sm text-muted-foreground">
                Set a goal between $50 and $50,000. You can always adjust it later.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="goalAmount"
                  type="number"
                  min={50}
                  max={50000}
                  step={1}
                  value={form.goalAmount}
                  onChange={(e) => update('goalAmount', e.target.value)}
                  className="pl-7"
                  placeholder="500"
                  aria-invalid={!!errors.goalAmount}
                />
              </div>
              {errors.goalAmount && <p className="text-sm text-red-500">{errors.goalAmount}</p>}
              {goalDollars > 0 && (
                <p className="text-sm text-muted-foreground">
                  Goal: <span className="font-medium text-foreground">${goalDollars.toLocaleString()}</span>
                </p>
              )}
            </div>

            <hr className="border-border" />

            {/* Fund Release Plan */}
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Fund Release Plan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Campaigns with a clear plan raise up to 3x more. Donors are more
                likely to give when they can see exactly where their money goes.
                Break your campaign into three phases so supporters can follow
                your progress and celebrate each milestone with you.
              </p>
            </div>

            {form.milestones.map((milestone, i) => {
              const phase = i + 1;
              const maxPct = phase === 1 ? 40 : 60;
              const dollarAmount = goalDollars > 0
                ? Math.round(goalDollars * (parseInt(milestone.fundPercentage) || 0) / 100)
                : 0;
              return (
                <div key={i} className="space-y-4 rounded-lg border border-border bg-card p-6">
                  <h3 className="font-bold text-foreground">Phase {phase}</h3>

                  <div className="space-y-2">
                    <Label htmlFor={`milestone-${i}-title`} className="font-semibold">
                      What will this phase cover?
                    </Label>
                    <Input
                      id={`milestone-${i}-title`}
                      value={milestone.title}
                      onChange={(e) => updateMilestone(i, 'title', e.target.value)}
                      maxLength={200}
                      placeholder={
                        phase === 1
                          ? 'Initial expenses and urgent needs'
                          : phase === 2
                            ? 'Ongoing costs and progress'
                            : 'Completion and remaining needs'
                      }
                      aria-invalid={!!errors[`m${i}_title`]}
                    />
                    {errors[`m${i}_title`] && (
                      <p className="text-sm text-red-500">{errors[`m${i}_title`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`milestone-${i}-description`} className="font-semibold">
                      Describe what these funds will cover
                    </Label>
                    <Textarea
                      id={`milestone-${i}-description`}
                      value={milestone.description}
                      onChange={(e) => updateMilestone(i, 'description', e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder={
                        phase === 1
                          ? 'List the most urgent expenses this campaign needs to address first.'
                          : phase === 2
                            ? 'Describe the next set of expenses or needs these funds will cover.'
                            : 'Describe the final expenses or goals the remaining funds will go toward.'
                      }
                      aria-invalid={!!errors[`m${i}_description`]}
                    />
                    {errors[`m${i}_description`] && (
                      <p className="text-sm text-red-500">{errors[`m${i}_description`]}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`milestone-${i}-percentage`} className="font-semibold">
                      Percentage of funds {phase === 1 && <span className="font-normal text-muted-foreground">(max 40%)</span>}
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-24">
                        <Input
                          id={`milestone-${i}-percentage`}
                          type="number"
                          min={10}
                          max={maxPct}
                          step={5}
                          value={milestone.fundPercentage}
                          onChange={(e) => updateMilestone(i, 'fundPercentage', e.target.value)}
                          className="pr-7"
                          aria-invalid={!!errors[`m${i}_fundPercentage`]}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      {dollarAmount > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ${dollarAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {errors[`m${i}_fundPercentage`] && (
                      <p className="text-sm text-red-500">{errors[`m${i}_fundPercentage`]}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {errors.milestoneTotal && (
              <p className="text-center text-sm text-red-500">{errors.milestoneTotal}</p>
            )}
          </div>
        )}

        {/* ── Step 3: Review & Submit ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Campaign photo — placed here because the upload API requires
                authentication, and the auth gate fires at the step 2 → 3
                transition. By this point the user is guaranteed to be signed in. */}
            <div className="space-y-2">
              <Label>Campaign photo</Label>
              <p className="text-sm text-muted-foreground">
                A clear photo of the person or situation. Campaigns with real photos
                raise significantly more.
              </p>

              <PhotoUpload
                value={form.heroImageUrl}
                onChange={(url) => update('heroImageUrl', url)}
                error={errors.heroImageUrl}
              />

              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Photo tips</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>Show the person&apos;s face when possible. People donate to people</li>
                  <li>Use a clear, well-lit image (JPEG, PNG, or WebP, up to 5 MB)</li>
                  <li>Show strength and dignity, not helplessness</li>
                  <li>You must have the right to share this photo</li>
                </ul>
              </div>

              {!showPhotoCredit ? (
                <button
                  type="button"
                  onClick={() => setShowPhotoCredit(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Add photo credit
                </button>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="photoCredit">
                    Photo credit <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="photoCredit"
                    value={form.photoCredit}
                    onChange={(e) => update('photoCredit', e.target.value)}
                    maxLength={200}
                    placeholder="Photo by Jane Smith"
                  />
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Campaign preview card */}
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Review Your Campaign
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the details below, then agree to our guidelines and submit.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {/* Hero image preview */}
              {form.heroImageUrl && !imagePreviewError && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.heroImageUrl}
                    alt=""
                    className="aspect-[3/2] w-full object-cover"
                    onError={() => setImagePreviewError(true)}
                  />
                  {form.photoCredit && (
                    <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                      {form.photoCredit}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4 p-6">
                {/* Title & subject */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{form.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {form.subjectName} &middot; {form.subjectHometown}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="text-sm font-medium text-foreground">
                      {CATEGORIES.find((c) => c.value === form.category)?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Goal</p>
                    <p className="text-sm font-medium text-foreground">${goalDollars.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Relationship</p>
                    <p className="text-sm font-medium text-foreground">
                      {RELATIONS.find((r) => r.value === form.beneficiaryRelation)?.label}
                    </p>
                  </div>
                </div>

                {/* Story preview */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Story</p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="mt-1 max-h-40 overflow-y-auto text-sm text-foreground whitespace-pre-wrap">
                    {form.story}
                  </div>
                </div>

                {/* Fund Release Plan summary */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Fund Release Plan</p>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {form.milestones.map((m, i) => (
                      <p key={i} className="text-sm text-foreground">
                        <span className="text-muted-foreground">Phase {i + 1}:</span>{' '}
                        {m.title || <span className="italic text-muted-foreground">Untitled</span>}{' '}
                        <span className="text-muted-foreground">
                          ({m.fundPercentage}%{goalDollars > 0 && ` / $${Math.round(goalDollars * (parseInt(m.fundPercentage) || 0) / 100).toLocaleString()}`})
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Legal agreements */}
            <div className="space-y-4 rounded-lg border border-border bg-card p-6">
              <p className="text-sm font-medium text-foreground">Before submitting</p>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreedToTerms"
                  checked={form.agreedToTerms}
                  onCheckedChange={(v) => update('agreedToTerms', v === true)}
                  aria-invalid={!!errors.agreedToTerms}
                />
                <Label htmlFor="agreedToTerms" className="cursor-pointer text-sm font-normal leading-relaxed">
                  I agree to LastDonor&apos;s{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Privacy Policy
                  </a>
                  . I understand that LastDonor does not charge a platform fee,
                  and that payment processing fees (2.9% + $0.30) apply to each donation.
                </Label>
              </div>
              {errors.agreedToTerms && <p className="ml-8 text-sm text-red-500">{errors.agreedToTerms}</p>}

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="confirmedTruthful"
                  checked={form.confirmedTruthful}
                  onCheckedChange={(v) => update('confirmedTruthful', v === true)}
                  aria-invalid={!!errors.confirmedTruthful}
                />
                <Label htmlFor="confirmedTruthful" className="cursor-pointer text-sm font-normal leading-relaxed">
                  I confirm that all information in this campaign is accurate and
                  truthful. I understand that creating a fraudulent campaign may
                  result in account suspension and legal action.
                </Label>
              </div>
              {errors.confirmedTruthful && <p className="ml-8 text-sm text-red-500">{errors.confirmedTruthful}</p>}

              {/* Beneficiary consent — only when raising for someone else */}
              {showBeneficiaryConsent && (
                <>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="beneficiaryConsent"
                      checked={form.beneficiaryConsent}
                      onCheckedChange={(v) => update('beneficiaryConsent', v === true)}
                      aria-invalid={!!errors.beneficiaryConsent}
                    />
                    <Label htmlFor="beneficiaryConsent" className="cursor-pointer text-sm font-normal leading-relaxed">
                      {form.subjectName || 'The person named above'} is aware that I am
                      creating this campaign on their behalf and has given consent for
                      their story to be shared publicly.
                    </Label>
                  </div>
                  {errors.beneficiaryConsent && <p className="ml-8 text-sm text-red-500">{errors.beneficiaryConsent}</p>}
                </>
              )}
            </div>

            {/* Instant-live info */}
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground">What happens next?</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>Your campaign goes live immediately and can start accepting donations</li>
                <li>Share your campaign link with friends, family, and social media</li>
                <li>You&apos;ll receive an email with tips to maximize your reach</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="mt-8 flex justify-between">
        {step > 0 ? (
          <Button variant="outline" onClick={goBack} type="button" className="rounded-full">
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <Button onClick={goNext} type="button" className="rounded-full">
            Continue
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} type="button" className="rounded-full">
            {submitting ? 'Publishing...' : 'Publish Campaign'}
          </Button>
        )}
      </div>
    </div>
  );
}
