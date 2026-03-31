/**
 * Instant-Live Architecture — Comprehensive Tests
 *
 * Tests the complete instant-live campaign lifecycle:
 *  1. Document requirements (per-category, per-relationship)
 *  2. Email templates (first donation, completion, verification reminders)
 *  3. Notification functions (new functions + updated existing)
 *  4. Campaign instant-live creation (status: active, publishedAt, welcome email)
 *  5. Webhook triggers (first donation, campaign completion, milestone auto-reach)
 *  6. Evidence post-completion gate (409 if campaign not completed)
 *  7. Congratulations page (post-creation redirect target)
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  getDocumentRequirements,
  formatDocumentRequirementsHtml,
} from '@/lib/document-requirements';
import {
  firstDonationCelebrationEmail,
  campaignCompletedCreatorEmail,
  verificationReminderEmail,
  welcomeCampaignerEmail,
  milestoneReachedCreatorEmail,
  milestoneReachedAdminEmail,
  campaignSubmittedEmail,
} from '@/lib/email-templates';

const ROOT = resolve(__dirname, '../../..');

// ═══════════════════════════════════════════════════════════════════════════
// 1. DOCUMENT REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Document requirements', () => {
  describe('getDocumentRequirements()', () => {
    it('returns category-specific documents for medical', () => {
      const { category } = getDocumentRequirements('medical', 'self');
      expect(category.label).toBe('Medical');
      expect(category.documents.length).toBeGreaterThanOrEqual(1);
      expect(category.documents.some(d => d.type === 'hospital_letter')).toBe(true);
    });

    it('returns category-specific documents for disaster', () => {
      const { category } = getDocumentRequirements('disaster', 'self');
      expect(category.label).toBe('Disaster Relief');
      expect(category.documents.some(d => d.type === 'official_letter')).toBe(true);
    });

    it('returns category-specific documents for education', () => {
      const { category } = getDocumentRequirements('education', 'self');
      expect(category.label).toBe('Education');
      expect(category.documents.some(d => d.label.includes('Enrollment'))).toBe(true);
    });

    it('returns category-specific documents for charity', () => {
      const { category } = getDocumentRequirements('charity', 'organization');
      expect(category.label).toBe('Charity');
      expect(category.documents.some(d => d.label.includes('Organization'))).toBe(true);
    });

    it('falls back to empty docs for unknown category', () => {
      const { category } = getDocumentRequirements('nonexistent', 'self');
      expect(category.label).toBe('nonexistent');
      expect(category.documents).toHaveLength(0);
    });

    it('returns relationship-specific documents for self', () => {
      const { relationship } = getDocumentRequirements('medical', 'self');
      expect(relationship.label).toBe('Raising for yourself');
      expect(relationship.documents.some(d => d.type === 'government_id')).toBe(true);
      expect(relationship.documents.some(d => d.type === 'selfie')).toBe(true);
    });

    it('returns relationship-specific documents for family', () => {
      const { relationship } = getDocumentRequirements('medical', 'family');
      expect(relationship.label).toBe('Raising for a family member');
      expect(relationship.documents.some(d => d.type === 'government_id')).toBe(true);
      expect(relationship.documents.some(d => d.label.includes('relationship'))).toBe(true);
    });

    it('returns relationship-specific documents for organization', () => {
      const { relationship } = getDocumentRequirements('charity', 'organization');
      expect(relationship.label).toBe('Raising for an organization');
      expect(relationship.documents.some(d => d.label.includes('Authorization'))).toBe(true);
      expect(relationship.documents.some(d => d.label.includes('Organization registration'))).toBe(true);
    });

    it('falls back to "other" for unknown relationship', () => {
      const { relationship } = getDocumentRequirements('medical', 'invalid_rel');
      expect(relationship.label).toBe('Raising for someone else');
    });

    it('combines category and relationship documents', () => {
      const { combined } = getDocumentRequirements('medical', 'self');
      // Should have at least relationship docs (id + selfie) + category docs (hospital letter)
      expect(combined.length).toBeGreaterThanOrEqual(3);
    });

    it('deduplicates documents by type+label', () => {
      const { combined } = getDocumentRequirements('charity', 'organization');
      // 'organization' relationship has an "Organization registration" doc
      // 'charity' category also has an "Organization registration" doc
      // type is 'official_letter' for both — should deduplicate
      const orgRegDocs = combined.filter(d => d.label === 'Organization registration');
      expect(orgRegDocs).toHaveLength(1);
    });

    it('relationship docs come before category docs', () => {
      const { combined, relationship } = getDocumentRequirements('medical', 'self');
      // First doc should be from relationship (government_id or selfie)
      const firstRelDoc = relationship.documents[0];
      expect(combined[0].type).toBe(firstRelDoc.type);
      expect(combined[0].label).toBe(firstRelDoc.label);
    });

    it('marks required documents correctly', () => {
      const { combined } = getDocumentRequirements('medical', 'self');
      const govId = combined.find(d => d.type === 'government_id');
      expect(govId?.required).toBe(true);
      const hospitalLetter = combined.find(d => d.type === 'hospital_letter');
      expect(hospitalLetter?.required).toBe(true);
    });

    it('marks optional documents correctly', () => {
      const { category } = getDocumentRequirements('medical', 'self');
      const receipt = category.documents.find(d => d.type === 'receipt');
      expect(receipt?.required).toBe(false);
    });

    it('handles all 23 categories without errors', () => {
      const categories = [
        'medical', 'disaster', 'military', 'veterans', 'memorial',
        'first-responders', 'community', 'essential-needs', 'emergency',
        'charity', 'education', 'animal', 'environment', 'business',
        'competition', 'creative', 'event', 'faith', 'family',
        'sports', 'travel', 'volunteer', 'wishes',
      ];
      for (const cat of categories) {
        const result = getDocumentRequirements(cat, 'self');
        expect(result.category.label).toBeTruthy();
        expect(result.combined.length).toBeGreaterThanOrEqual(2); // At minimum: id + selfie from 'self'
      }
    });

    it('handles all 7 relationships without errors', () => {
      const relationships = [
        'self', 'family', 'friend', 'colleague',
        'community_member', 'organization', 'other',
      ];
      for (const rel of relationships) {
        const result = getDocumentRequirements('medical', rel);
        expect(result.relationship.label).toBeTruthy();
        expect(result.relationship.documents.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('formatDocumentRequirementsHtml()', () => {
    it('returns HTML list items', () => {
      const html = formatDocumentRequirementsHtml('medical', 'self');
      expect(html).toContain('<li>');
      expect(html).toContain('</li>');
    });

    it('marks required documents with (required)', () => {
      const html = formatDocumentRequirementsHtml('medical', 'self');
      expect(html).toContain('(required)');
    });

    it('marks optional documents with (if available)', () => {
      const html = formatDocumentRequirementsHtml('medical', 'self');
      expect(html).toContain('(if available)');
    });

    it('includes bold label and description', () => {
      const html = formatDocumentRequirementsHtml('medical', 'self');
      expect(html).toContain('<strong>');
      expect(html).toContain('</strong>');
    });

    it('falls back to default docs for unknown category', () => {
      const html = formatDocumentRequirementsHtml('nonexistent_thing', 'self');
      // Should still return relationship docs (gov ID + selfie)
      expect(html).toContain('Government-issued photo ID');
    });

    it('includes category-specific content for medical', () => {
      const html = formatDocumentRequirementsHtml('medical', 'self');
      expect(html).toContain('Medical documentation');
    });

    it('includes category-specific content for education', () => {
      const html = formatDocumentRequirementsHtml('education', 'family');
      expect(html).toContain('Enrollment');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. EMAIL TEMPLATES — NEW TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

describe('Email templates — new lifecycle templates', () => {
  describe('firstDonationCelebrationEmail', () => {
    const email = firstDonationCelebrationEmail({
      campaignerName: 'Alice',
      campaignTitle: 'Help Alice',
      campaignSlug: 'help-alice-123',
      donorName: 'Bob',
      amount: 5000,
    });

    it('has a celebratory subject line', () => {
      expect(email.subject).toContain('First Donation');
      expect(email.subject).toContain('Help Alice');
    });

    it('shows donor name in body', () => {
      expect(email.html).toContain('Bob');
    });

    it('formats donation amount in body ($50.00)', () => {
      expect(email.html).toContain('$50.00');
    });

    it('links to campaign page CTA', () => {
      expect(email.html).toContain('/campaigns/help-alice-123');
    });

    it('links to campaign page', () => {
      expect(email.html).toContain('/campaigns/help-alice-123');
    });

    it('includes sharing tips', () => {
      expect(email.html).toContain('momentum');
    });

    it('does NOT request verification documents', () => {
      expect(email.html).not.toContain('identity verification');
      expect(email.html).not.toContain('passport');
    });
  });

  describe('campaignCompletedCreatorEmail', () => {
    const docHtml = '<li><strong>Medical documentation</strong> (required)</li>';
    const email = campaignCompletedCreatorEmail({
      campaignerName: 'Alice',
      campaignTitle: 'Help Alice',
      campaignSlug: 'help-alice-123',
      goalAmount: 100000,
      donorCount: 42,
      documentRequirementsHtml: docHtml,
    });

    it('has a congratulatory subject line', () => {
      expect(email.subject).toContain('Fully Funded');
      expect(email.subject).toContain('Help Alice');
    });

    it('shows goal amount formatted ($1000.00)', () => {
      expect(email.html).toContain('$1000.00');
    });

    it('shows donor count', () => {
      expect(email.html).toContain('42');
    });

    it('includes per-category document requirements', () => {
      expect(email.html).toContain(docHtml);
    });

    it('links to verification page CTA', () => {
      expect(email.html).toContain('/dashboard/campaigns/help-alice-123/verification');
      expect(email.html).toContain('Start Verification Now');
    });

    it('explains the fund release process', () => {
      expect(email.html).toContain('Phase 1');
      expect(email.html).toContain('Phases 2 and 3');
    });

    it('mentions 14-day deadline', () => {
      expect(email.html).toContain('14 days');
    });

    it('includes verify@lastdonor.org support', () => {
      expect(email.html).toContain('verify@lastdonor.org');
    });

    it('handles singular donor count', () => {
      const singleEmail = campaignCompletedCreatorEmail({
        campaignerName: 'Alice',
        campaignTitle: 'Help Alice',
        campaignSlug: 'help-alice-123',
        goalAmount: 100000,
        donorCount: 1,
        documentRequirementsHtml: docHtml,
      });
      expect(singleEmail.html).toContain('1</strong> generous donor');
      expect(singleEmail.html).not.toContain('1</strong> generous donors');
    });
  });

  describe('verificationReminderEmail', () => {
    const baseParams = {
      campaignerName: 'Alice',
      campaignTitle: 'Help Alice',
      campaignSlug: 'help-alice-123',
      daysSinceCompletion: 3,
      deadlineDays: 11,
    };

    it('gentle urgency has green heading', () => {
      const email = verificationReminderEmail({ ...baseParams, urgencyLevel: 'gentle' });
      expect(email.subject).toContain('Reminder');
      expect(email.html).toContain('Friendly Reminder');
      expect(email.html).toContain('#0F766E');
    });

    it('firm urgency mentions days left', () => {
      const email = verificationReminderEmail({ ...baseParams, urgencyLevel: 'firm' });
      expect(email.subject).toContain('11 Days Left');
      expect(email.html).toContain('Verification Required');
    });

    it('warning urgency turns orange', () => {
      const email = verificationReminderEmail({ ...baseParams, deadlineDays: 5, urgencyLevel: 'warning' });
      expect(email.subject).toContain('Urgent');
      expect(email.html).toContain('#EA580C');
    });

    it('final urgency turns red', () => {
      const email = verificationReminderEmail({ ...baseParams, deadlineDays: 2, urgencyLevel: 'final' });
      expect(email.subject).toContain('Final Notice');
      expect(email.html).toContain('#DC2626');
      expect(email.html).toContain('refunded');
    });

    it('all urgency levels link to verification page', () => {
      for (const level of ['gentle', 'firm', 'warning', 'final'] as const) {
        const email = verificationReminderEmail({ ...baseParams, urgencyLevel: level });
        expect(email.html).toContain('/dashboard/campaigns/help-alice-123/verification');
        expect(email.html).toContain('Complete Verification Now');
      }
    });

    it('all urgency levels include support email', () => {
      for (const level of ['gentle', 'firm', 'warning', 'final'] as const) {
        const email = verificationReminderEmail({ ...baseParams, urgencyLevel: level });
        expect(email.html).toContain('verify@lastdonor.org');
      }
    });

    it('shows days since completion in body', () => {
      const email = verificationReminderEmail({ ...baseParams, daysSinceCompletion: 7, urgencyLevel: 'firm' });
      expect(email.html).toContain('7 days');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. EMAIL TEMPLATES — UPDATED TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

describe('Email templates — updated for instant-live', () => {
  describe('welcomeCampaignerEmail — sharing focus', () => {
    const email = welcomeCampaignerEmail({
      campaignerName: 'Alice',
      campaignTitle: 'Help Alice',
      campaignSlug: 'help-alice-123',
    });

    it('focuses on sharing, not review', () => {
      expect(email.subject).not.toContain('Review');
      expect(email.subject).not.toContain('Submitted');
    });

    it('links to campaign page, not verification', () => {
      expect(email.html).toContain('/campaigns/help-alice-123');
      expect(email.html).not.toContain('/verification');
    });

    it('includes sharing tips', () => {
      expect(email.html).toContain('5 close friends');
    });

    it('mentions first donation stat', () => {
      expect(email.html).toContain('first donation');
    });

    it('does NOT request documents', () => {
      expect(email.html).not.toMatch(/government.issued/i);
      expect(email.html).not.toContain('passport');
    });
  });

  describe('milestoneReachedCreatorEmail — celebration only', () => {
    const email = milestoneReachedCreatorEmail({
      campaignerName: 'Alice',
      campaignTitle: 'Help Alice',
      campaignSlug: 'help-alice-123',
      milestoneTitle: 'Phase 1',
      phaseNumber: 1,
      fundAmount: 30000,
    });

    it('celebrates the milestone', () => {
      expect(email.subject).toContain('Phase 1');
      expect(email.subject).toContain('Funded');
    });

    it('links to campaign page for continued sharing', () => {
      expect(email.html).toContain('/campaigns/help-alice-123');
    });

    it('does NOT request evidence during campaign', () => {
      expect(email.html).not.toContain('Submit Evidence');
      expect(email.html).not.toContain('evidence');
    });

    it('mentions fund release after full funding', () => {
      expect(email.html).toContain('fully funded');
    });
  });

  describe('milestoneReachedAdminEmail — FYI only', () => {
    const email = milestoneReachedAdminEmail({
      campaignTitle: 'Help Alice',
      campaignSlug: 'help-alice-123',
      milestoneTitle: 'Phase 1',
      phaseNumber: 1,
      fundAmount: 30000,
      creatorName: 'Alice',
    });

    it('is informational, no action required', () => {
      expect(email.html).toContain('No action required');
    });

    it('links to admin campaigns page', () => {
      expect(email.html).toContain('/admin/campaigns');
    });

    it('mentions fund release after completion', () => {
      expect(email.html).toContain('completion');
    });
  });

  describe('campaignSubmittedEmail — live confirmation', () => {
    const email = campaignSubmittedEmail({
      campaignTitle: 'Help Alice',
      creatorName: 'Alice',
      category: 'medical',
      goalAmount: 100000,
      campaignId: '00000000-0000-4000-a000-000000000001',
    });

    it('says campaign is live/published', () => {
      const combinedText = email.subject + email.html;
      expect(combinedText).toMatch(/live|published|active/i);
    });

    it('does NOT say "Submitted for Review"', () => {
      const combinedText = email.subject + email.html;
      expect(combinedText).not.toContain('Submitted for Review');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. NOTIFICATION FUNCTIONS — STATIC ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

describe('Notification functions — new lifecycle notifications', () => {
  const notifSource = readFileSync(resolve(ROOT, 'src/lib/notifications.ts'), 'utf-8');

  describe('notifyCreatorFirstDonation', () => {
    it('is exported', () => {
      expect(notifSource).toContain('export async function notifyCreatorFirstDonation');
    });

    it('uses campaign_donation_received type', () => {
      const fn = notifSource.match(/notifyCreatorFirstDonation[\s\S]*?type:\s*'([^']+)'/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toBe('campaign_donation_received');
    });

    it('links to campaign page', () => {
      const fn = notifSource.match(/notifyCreatorFirstDonation[\s\S]*?link:\s*`([^`]+)`/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain('/campaigns/');
    });

    it('handles anonymous donors', () => {
      expect(notifSource).toContain("p.isAnonymous ? 'An anonymous supporter' : p.donorName");
    });
  });

  describe('notifyCreatorCampaignCompleted', () => {
    it('is exported', () => {
      expect(notifSource).toContain('export async function notifyCreatorCampaignCompleted');
    });

    it('uses campaign_completed type', () => {
      const fn = notifSource.match(/notifyCreatorCampaignCompleted[\s\S]*?type:\s*'([^']+)'/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toBe('campaign_completed');
    });

    it('links to campaign verification page', () => {
      const fn = notifSource.match(/notifyCreatorCampaignCompleted[\s\S]*?link:\s*`([^`]+)`/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain('/dashboard/campaigns/');
      expect(fn![1]).toContain('/verification');
    });

    it('passes documentRequirementsHtml to email template', () => {
      expect(notifSource).toContain('documentRequirementsHtml: p.documentRequirementsHtml');
    });
  });

  describe('notifyVerificationReminder', () => {
    it('is exported', () => {
      expect(notifSource).toContain('export async function notifyVerificationReminder');
    });

    it('uses info_request type', () => {
      const fn = notifSource.match(/notifyVerificationReminder[\s\S]*?type:\s*'([^']+)'/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toBe('info_request');
    });

    it('links to campaign verification page', () => {
      const fn = notifSource.match(/notifyVerificationReminder[\s\S]*?link:\s*`([^`]+)`/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain('/verification');
    });

    it('has different title for final urgency', () => {
      expect(notifSource).toContain("p.urgencyLevel === 'final'");
      expect(notifSource).toContain('Final Notice');
    });
  });

  describe('updated notifyWelcomeCampaigner', () => {
    it('takes campaignSlug parameter', () => {
      expect(notifSource).toContain('campaignSlug');
      // Verify the welcome function references campaignSlug
      const fn = notifSource.match(/notifyWelcomeCampaigner[\s\S]*?campaignSlug/);
      expect(fn).not.toBeNull();
    });

    it('links to campaign page, not verification', () => {
      const fn = notifSource.match(/notifyWelcomeCampaigner[\s\S]*?link:\s*`([^`]+)`/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain('/campaigns/');
      expect(fn![1]).not.toContain('/verification');
    });
  });

  describe('imports new email templates', () => {
    it('imports firstDonationCelebrationEmail', () => {
      expect(notifSource).toContain('firstDonationCelebrationEmail');
    });

    it('imports campaignCompletedCreatorEmail', () => {
      expect(notifSource).toContain('campaignCompletedCreatorEmail');
    });

    it('imports verificationReminderEmail', () => {
      expect(notifSource).toContain('verificationReminderEmail');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. CAMPAIGN CREATION — INSTANT-LIVE
// ═══════════════════════════════════════════════════════════════════════════

describe('Campaign creation — instant-live', () => {
  const routeSource = readFileSync(resolve(ROOT, 'src/app/api/v1/user-campaigns/route.ts'), 'utf-8');

  it('sets status to active (not draft)', () => {
    expect(routeSource).toContain("status: 'active'");
    expect(routeSource).not.toMatch(/status:\s*'draft'/);
  });

  it('sets publishedAt on creation', () => {
    expect(routeSource).toContain('publishedAt: new Date()');
  });

  it('sets verificationStatus to unverified', () => {
    expect(routeSource).toContain("verificationStatus: 'unverified'");
  });

  it('audit event is campaign.published', () => {
    expect(routeSource).toContain("'campaign.published'");
    expect(routeSource).not.toContain("'campaign.submitted'");
  });

  it('calls notifyWelcomeCampaigner after creation', () => {
    expect(routeSource).toContain('notifyWelcomeCampaigner(');
  });

  it('calls notifyAdminsCampaignSubmitted after creation (FYI)', () => {
    expect(routeSource).toContain('notifyAdminsCampaignSubmitted(');
  });

  it('imports both notification functions', () => {
    expect(routeSource).toContain('notifyAdminsCampaignSubmitted');
    expect(routeSource).toContain('notifyWelcomeCampaigner');
  });

  it('passes campaignSlug to welcome notification', () => {
    const welcomeCall = routeSource.match(/notifyWelcomeCampaigner\(\{[\s\S]*?\}\)/);
    expect(welcomeCall).not.toBeNull();
    expect(welcomeCall![0]).toContain('campaignSlug');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. DONATION WEBHOOK — FIRST DONATION + COMPLETION TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════

describe('Donation webhook — lifecycle triggers', () => {
  const webhookSource = readFileSync(resolve(ROOT, 'src/app/api/v1/donations/webhook/route.ts'), 'utf-8');

  describe('transaction return values', () => {
    it('returns newRaised, goalAmount, justCompleted from transaction', () => {
      expect(webhookSource).toContain('return { newRaised, goalAmount, justCompleted }');
    });

    it('checks for duplicate (null txResult)', () => {
      expect(webhookSource).toContain('if (!txResult) return');
    });

    it('destructures transaction result', () => {
      expect(webhookSource).toContain('const { newRaised, goalAmount, justCompleted } = txResult');
    });
  });

  describe('first donation trigger', () => {
    it('detects first donation via campaign.donorCount === 0', () => {
      expect(webhookSource).toContain('campaign.donorCount === 0');
    });

    it('calls notifyCreatorFirstDonation', () => {
      expect(webhookSource).toContain('notifyCreatorFirstDonation(');
    });

    it('imports notifyCreatorFirstDonation', () => {
      const importLine = webhookSource.match(/import\s*\{[^}]*notifyCreatorFirstDonation[^}]*\}\s*from/);
      expect(importLine).not.toBeNull();
    });

    it('fetches creator for first donation notification', () => {
      // After donorCount === 0 check, it fetches the creator
      const afterFirstDonation = webhookSource.indexOf('campaign.donorCount === 0');
      const fetchCreator = webhookSource.indexOf('users.id, email: users.email, name: users.name', afterFirstDonation);
      expect(fetchCreator).toBeGreaterThan(afterFirstDonation);
    });
  });

  describe('campaign completion trigger', () => {
    it('tracks justCompleted flag in transaction', () => {
      expect(webhookSource).toContain('let justCompleted = false');
      expect(webhookSource).toContain('justCompleted = true');
    });

    it('triggers completion notification when justCompleted', () => {
      expect(webhookSource).toContain('if (justCompleted && campaign.creatorId)');
    });

    it('calls notifyCreatorCampaignCompleted', () => {
      expect(webhookSource).toContain('notifyCreatorCampaignCompleted(');
    });

    it('imports notifyCreatorCampaignCompleted', () => {
      const importLine = webhookSource.match(/import\s*\{[^}]*notifyCreatorCampaignCompleted[^}]*\}\s*from/);
      expect(importLine).not.toBeNull();
    });

    it('generates document requirements HTML for completion email', () => {
      expect(webhookSource).toContain('formatDocumentRequirementsHtml(');
    });

    it('imports formatDocumentRequirementsHtml', () => {
      expect(webhookSource).toContain("from '@/lib/document-requirements'");
    });
  });

  describe('milestone auto-reach on completion', () => {
    it('marks all pending milestones as reached on completion', () => {
      // Inside the completion block (justCompleted = true), it bulk-updates milestones
      expect(webhookSource).toContain("status: 'reached'");
    });

    it('only updates pending milestones (not already reached ones)', () => {
      // Should have a where clause filtering by status = 'pending'
      expect(webhookSource).toContain("eq(campaignMilestones.status, 'pending')");
    });

    it('only applies milestone auto-reach when milestoneFundRelease is enabled', () => {
      expect(webhookSource).toContain('campaign.milestoneFundRelease');
    });
  });

  describe('milestone detection is celebration-only', () => {
    it('comments indicate celebration only, no evidence request', () => {
      expect(webhookSource).toContain('celebration only');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. EVIDENCE POST-COMPLETION GATE
// ═══════════════════════════════════════════════════════════════════════════

describe('Evidence submission — post-completion gate', () => {
  const evidenceSource = readFileSync(
    resolve(ROOT, 'src/app/api/v1/campaigns/[slug]/milestones/[milestoneId]/evidence/route.ts'),
    'utf-8',
  );

  it('selects campaign status', () => {
    expect(evidenceSource).toContain('status: campaigns.status');
  });

  it('blocks evidence submission when campaign is not completed', () => {
    expect(evidenceSource).toContain("campaign.status !== 'completed'");
  });

  it('returns 409 Conflict for non-completed campaigns', () => {
    // Check for 409 status near the completion check
    const completionCheck = evidenceSource.indexOf("campaign.status !== 'completed'");
    const conflictResponse = evidenceSource.indexOf('409', completionCheck);
    expect(conflictResponse).toBeGreaterThan(completionCheck);
    expect(conflictResponse - completionCheck).toBeLessThan(500); // Within reasonable distance
  });

  it('uses CONFLICT error code', () => {
    expect(evidenceSource).toContain("code: 'CONFLICT'");
  });

  it('provides user-friendly error message', () => {
    expect(evidenceSource).toContain('Evidence can only be submitted after the campaign is fully funded');
  });

  it('encourages continued sharing', () => {
    expect(evidenceSource).toContain('Keep sharing your campaign');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. CONGRATULATIONS PAGE
// ═══════════════════════════════════════════════════════════════════════════

describe('Congratulations page', () => {
  const pageSource = readFileSync(
    resolve(ROOT, 'src/app/campaigns/[slug]/congratulations/page.tsx'),
    'utf-8',
  );
  const clientSource = readFileSync(
    resolve(ROOT, 'src/app/campaigns/[slug]/congratulations/client.tsx'),
    'utf-8',
  );

  describe('server component (page.tsx)', () => {
    it('is auth-gated', () => {
      expect(pageSource).toContain("redirect(`/login");
    });

    it('fetches campaign by slug and creator match', () => {
      expect(pageSource).toContain('eq(campaigns.slug, slug)');
      expect(pageSource).toContain('eq(campaigns.creatorId, session.user.id)');
    });

    it('returns 404 if campaign not found or not owned', () => {
      expect(pageSource).toContain('notFound()');
    });

    it('sets noindex robots directive', () => {
      expect(pageSource).toContain('index: false');
    });

    it('has correct page title', () => {
      expect(pageSource).toContain('Your Campaign Is Live!');
    });
  });

  describe('client component (client.tsx)', () => {
    it('is a client component', () => {
      expect(clientSource).toContain("'use client'");
    });

    it('has copy link functionality', () => {
      expect(clientSource).toContain('clipboard');
      expect(clientSource).toContain('setCopied');
    });

    it('uses ShareButtons component', () => {
      expect(clientSource).toContain('ShareButtons');
    });

    it('uses CampaignHeroImage component', () => {
      expect(clientSource).toContain('CampaignHeroImage');
    });

    it('links to campaign view page', () => {
      expect(clientSource).toContain('View');
      expect(clientSource).toContain('campaign.slug');
    });

    it('links to dashboard', () => {
      expect(clientSource).toContain('/dashboard');
    });

    it('shows campaign goal formatting', () => {
      expect(clientSource).toContain('centsToDollars');
    });

    it('shows category label', () => {
      expect(clientSource).toContain('CATEGORY_LABELS');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. FORM REDIRECT
// ═══════════════════════════════════════════════════════════════════════════

describe('ShareYourStoryForm — congratulations redirect', () => {
  const formSource = readFileSync(
    resolve(ROOT, 'src/app/share-your-story/ShareYourStoryForm.tsx'),
    'utf-8',
  );

  it('redirects to congratulations page after submission', () => {
    expect(formSource).toContain('/congratulations');
  });

  it('uses campaign slug in redirect URL', () => {
    expect(formSource).toMatch(/campaigns\/\$\{.*slug.*\}\/congratulations/);
  });

  it('says "Your Campaign Is Live!" not "Submitted for Review"', () => {
    expect(formSource).toContain('Your Campaign Is Live!');
    expect(formSource).not.toContain('Submitted for Review');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. CROSS-CUTTING ARCHITECTURAL INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Architectural invariants', () => {
  const webhookSource = readFileSync(resolve(ROOT, 'src/app/api/v1/donations/webhook/route.ts'), 'utf-8');
  const notifSource = readFileSync(resolve(ROOT, 'src/lib/notifications.ts'), 'utf-8');
  const templateSource = readFileSync(resolve(ROOT, 'src/lib/email-templates.ts'), 'utf-8');

  it('milestones are celebration-only during campaign (no evidence request in webhook)', () => {
    // The milestone detection section should NOT call notifyAdminEvidenceSubmitted
    // or reference evidence submission CTA
    const milestoneSection = webhookSource.slice(
      webhookSource.indexOf('Milestone threshold detection'),
    );
    expect(milestoneSection).not.toContain('notifyAdminEvidenceSubmitted');
    expect(milestoneSection).not.toContain('Submit Evidence');
  });

  it('welcome email focuses on sharing, not verification', () => {
    const fnMatch = templateSource.match(/function welcomeCampaignerEmail[\s\S]*?^}/m);
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).not.toContain('/verification');
  });

  it('milestone creator notification links to campaign, not verification', () => {
    const fnMatch = notifSource.match(/notifyCreatorMilestoneReached[\s\S]*?link:\s*`([^`]+)`/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![1]).toContain('/campaigns/');
    expect(fnMatch![1]).not.toContain('/verification');
  });

  it('verification requests only happen post-completion (campaignCompletedCreatorEmail)', () => {
    // campaignCompletedCreatorEmail should reference verification
    const completedIdx = templateSource.indexOf('function campaignCompletedCreatorEmail');
    expect(completedIdx).toBeGreaterThan(-1);
    const completedFnBody = templateSource.slice(completedIdx, completedIdx + 3000);
    expect(completedFnBody).toContain('/verification');

    // verificationReminderEmail should reference verification
    const reminderIdx = templateSource.indexOf('function verificationReminderEmail');
    expect(reminderIdx).toBeGreaterThan(-1);
    const reminderFnBody = templateSource.slice(reminderIdx, reminderIdx + 3000);
    expect(reminderFnBody).toContain('/verification');
  });

  it('fund release flow: campaign → completion → verification → evidence → review → release', () => {
    // This is a logical test: verify the right notifications reference the right endpoints
    // 1. During campaign: milestone reached → celebration (campaign page link)
    const milestoneCreatorFn = notifSource.match(/notifyCreatorMilestoneReached[\s\S]*?link:\s*`([^`]+)`/);
    expect(milestoneCreatorFn![1]).toContain('/campaigns/');

    // 2. On completion: → verification request (verification page link)
    const completionFn = notifSource.match(/notifyCreatorCampaignCompleted[\s\S]*?link:\s*`([^`]+)`/);
    expect(completionFn![1]).toContain('/verification');

    // 3. Reminder: → verification page
    const reminderFn = notifSource.match(/notifyVerificationReminder[\s\S]*?link:\s*`([^`]+)`/);
    expect(reminderFn![1]).toContain('/verification');
  });
});
