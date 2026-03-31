/**
 * Notification service — creates in-app notifications and sends emails.
 *
 * Designed to be called from admin API handlers AFTER the primary action
 * succeeds. Errors in notification delivery never block the admin action.
 *
 * Each notifyXxx function:
 *  1. Inserts an in-app notification row per recipient
 *  2. Sends an email (respecting user preferences)
 *  3. Marks emailSent = true on the notification row
 */

import { db } from '@/db';
import { notifications, donations, users, donorCampaignSubscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { resend } from '@/lib/resend';
import {
  donationRefundedEmail,
  donationRefundReversedEmail,
  campaignCompletedEmail,
  campaignArchivedEmail,
  campaignStatusChangedEmail,
  roleChangedEmail,
  accountDeletedEmail,
  campaignSubmittedEmail,
  campaignPausedDonorEmail,
  campaignResumedDonorEmail,
  campaignSuspendedDonorEmail,
  infoRequestCampaignerEmail,
  milestoneAchievedDonorEmail,
  fundReleasedEmail,
  milestoneReachedCreatorEmail,
  milestoneReachedAdminEmail,
  evidenceSubmittedAdminEmail,
  welcomeCampaignerEmail,
  bulkRefundCompletedEmail,
  donationReceivedEmail,
  firstDonationCelebrationEmail,
  campaignCompletedCreatorEmail,
  verificationReminderEmail,
  verificationDocumentsAdminEmail,
  verificationApprovedCreatorEmail,
  verificationRejectedCreatorEmail,
  withdrawalCompletedEmail,
  withdrawalFailedEmail,
} from '@/lib/email-templates';
import type { NotificationType } from '@/types';

const FROM_ADDRESS = 'LastDonor.org <noreply@lastdonor.org>';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if a user has opted out of notification emails. */
async function wantsEmail(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const prefs = row?.preferences as Record<string, unknown> | null;
  // Default to true — only skip if explicitly false
  return prefs?.emailNotifications !== false;
}

/** Insert notification row and optionally send email. Returns silently on error. */
export async function createAndEmail(p: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  email?: { to: string; subject: string; html: string };
}) {
  try {
    const [notif] = await db
      .insert(notifications)
      .values({
        userId: p.userId,
        type: p.type,
        title: p.title,
        message: p.message,
        link: p.link ?? null,
      })
      .returning({ id: notifications.id });

    if (p.email) {
      const canEmail = await wantsEmail(p.userId);
      if (canEmail) {
        const { error: sendError } = await resend.emails.send({
          from: FROM_ADDRESS,
          to: p.email.to,
          subject: p.email.subject,
          html: p.email.html,
        });
        if (sendError) {
          console.error(`[notifications] Resend API error for ${p.userId} (${p.type}):`, sendError);
        } else {
          await db
            .update(notifications)
            .set({ emailSent: true })
            .where(eq(notifications.id, notif.id));
        }
      }
    }
  } catch (err) {
    console.error(`[notifications] Failed to notify ${p.userId} (${p.type}):`, err);
  }
}

/** Send an email to an address without creating an in-app notification. */
async function sendEmailOnly(p: { to: string; subject: string; html: string }) {
  try {
    const { error: sendError } = await resend.emails.send({ from: FROM_ADDRESS, to: p.to, subject: p.subject, html: p.html });
    if (sendError) {
      console.error(`[notifications] Resend API error for ${p.to}:`, sendError);
    }
  } catch (err) {
    console.error(`[notifications] Failed to send email to ${p.to}:`, err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Notify a donor that their donation has been refunded (or refund reversed).
 */
export async function notifyDonationRefund(p: {
  donationId: string;
  donorEmail: string;
  donorName: string;
  amount: number;
  campaignTitle: string;
  campaignSlug: string;
  refunded: boolean;
}) {
  // Find registered user by email (might be a guest donation)
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, p.donorEmail))
    .limit(1);

  const emailContent = p.refunded
    ? donationRefundedEmail(p)
    : donationRefundReversedEmail(p);

  const type: NotificationType = p.refunded ? 'donation_refunded' : 'donation_refund_reversed';
  const title = p.refunded
    ? `Donation of $${(p.amount / 100).toFixed(2)} refunded`
    : `Refund reversed for $${(p.amount / 100).toFixed(2)} donation`;
  const message = p.refunded
    ? `Your donation to "${p.campaignTitle}" has been refunded.`
    : `The refund on your donation to "${p.campaignTitle}" has been reversed.`;

  if (user) {
    // Registered user: in-app notification + email
    await createAndEmail({
      userId: user.id,
      type,
      title,
      message,
      link: `/campaigns/${p.campaignSlug}`,
      email: { to: p.donorEmail, ...emailContent },
    });
  } else {
    // Guest donor: email only (no in-app notification possible)
    await sendEmailOnly({ to: p.donorEmail, ...emailContent });
  }
}

/**
 * Notify all real donors of a campaign when the campaign status changes.
 * Selects the appropriate template based on newStatus.
 */
export async function notifyCampaignStatusChange(p: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  previousStatus: string;
  newStatus: string;
  goalAmount: number;
}) {
  // Only notify on significant status changes — not draft toggling
  const NOTIFY_STATUSES = ['completed', 'archived'];
  // For completed/archived, we send specific templates. For other transitions that
  // donors would care about (e.g., back to active from LDZ), use the generic template.
  const shouldNotifyDonors = NOTIFY_STATUSES.includes(p.newStatus) ||
    (p.previousStatus === 'last_donor_zone' && p.newStatus === 'active');

  if (!shouldNotifyDonors) return;

  // Fetch all unique donors (both registered and guest) for this campaign
  const campaignDonors = await db
    .select({
      donorEmail: donations.donorEmail,
      donorName: donations.donorName,
      userId: donations.userId,
    })
    .from(donations)
    .where(
      and(
        eq(donations.campaignId, p.campaignId),
        eq(donations.source, 'real'),
        eq(donations.refunded, false),
      ),
    );

  // Deduplicate by email
  const seen = new Set<string>();
  const uniqueDonors: typeof campaignDonors = [];
  for (const d of campaignDonors) {
    if (!seen.has(d.donorEmail)) {
      seen.add(d.donorEmail);
      uniqueDonors.push(d);
    }
  }

  let type: NotificationType;
  let titleText: string;
  let messageText: string;

  if (p.newStatus === 'completed') {
    type = 'campaign_completed';
    titleText = `"${p.campaignTitle}" reached its goal!`;
    messageText = `The campaign "${p.campaignTitle}" has been completed. Thank you for your support!`;
  } else if (p.newStatus === 'archived') {
    type = 'campaign_archived';
    titleText = `Campaign "${p.campaignTitle}" concluded`;
    messageText = `The campaign "${p.campaignTitle}" has been concluded. Your contributions have been recorded.`;
  } else {
    type = 'campaign_status_changed';
    titleText = `"${p.campaignTitle}" status updated`;
    messageText = `The campaign "${p.campaignTitle}" is now active again.`;
  }

  for (const donor of uniqueDonors) {
    let emailContent: { subject: string; html: string };

    if (p.newStatus === 'completed') {
      emailContent = campaignCompletedEmail({
        donorName: donor.donorName,
        campaignTitle: p.campaignTitle,
        campaignSlug: p.campaignSlug,
        goalAmount: p.goalAmount,
      });
    } else if (p.newStatus === 'archived') {
      emailContent = campaignArchivedEmail({
        donorName: donor.donorName,
        campaignTitle: p.campaignTitle,
      });
    } else {
      emailContent = campaignStatusChangedEmail({
        donorName: donor.donorName,
        campaignTitle: p.campaignTitle,
        campaignSlug: p.campaignSlug,
        newStatus: p.newStatus,
      });
    }

    if (donor.userId) {
      await createAndEmail({
        userId: donor.userId,
        type,
        title: titleText,
        message: messageText,
        link: `/campaigns/${p.campaignSlug}`,
        email: { to: donor.donorEmail, ...emailContent },
      });
    } else {
      await sendEmailOnly({ to: donor.donorEmail, ...emailContent });
    }
  }
}

/**
 * Notify a user that their account role has been changed.
 */
export async function notifyRoleChange(p: {
  userId: string;
  userEmail: string;
  userName: string;
  previousRole: string;
  newRole: string;
}) {
  const emailContent = roleChangedEmail({
    userName: p.userName || 'User',
    previousRole: p.previousRole,
    newRole: p.newRole,
  });

  await createAndEmail({
    userId: p.userId,
    type: 'role_changed',
    title: `Your role changed to ${p.newRole}`,
    message: `Your account role has been updated from ${p.previousRole} to ${p.newRole}.`,
    link: p.newRole === 'editor' || p.newRole === 'admin' ? '/admin' : '/dashboard',
    email: { to: p.userEmail, ...emailContent },
  });
}

/**
 * Send account deletion email. Called BEFORE the user is deleted/anonymized.
 * No in-app notification (the account is being removed).
 */
export async function notifyAccountDeletion(p: {
  userEmail: string;
  userName: string;
}) {
  const emailContent = accountDeletedEmail({ userName: p.userName || 'User' });
  await sendEmailOnly({ to: p.userEmail, ...emailContent });
}

/**
 * Notify all admins that a user has published a new campaign.
 */
export async function notifyAdminsCampaignSubmitted(p: {
  campaignId: string;
  campaignTitle: string;
  creatorName: string;
  category: string;
  goalAmount: number;
}) {
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'admin'));

  const emailContent = campaignSubmittedEmail(p);

  for (const admin of admins) {
    await createAndEmail({
      userId: admin.id,
      type: 'campaign_submitted',
      title: `New campaign: "${p.campaignTitle}"`,
      message: `${p.creatorName} published a new campaign. Category: ${p.category}, Goal: $${(p.goalAmount / 100).toFixed(2)}.`,
      link: `/admin/campaigns/${p.campaignId}/edit`,
      email: { to: admin.email, ...emailContent },
    });
  }
}

// ─── Phase 2: Governance & Transparency notifications ───────────────────────

/**
 * Fetch subscribers for a campaign. Returns subscribed donors (both registered and guest).
 */
async function getSubscribedDonors(campaignId: string) {
  return db
    .select({
      donorEmail: donorCampaignSubscriptions.donorEmail,
      userId: donorCampaignSubscriptions.userId,
    })
    .from(donorCampaignSubscriptions)
    .where(
      and(
        eq(donorCampaignSubscriptions.campaignId, campaignId),
        eq(donorCampaignSubscriptions.subscribed, true),
      ),
    );
}

/** Helper: resolve a donor name from the user record or donation record. */
async function resolveDonorName(email: string): Promise<string> {
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (user?.name) return user.name;

  const [donation] = await db
    .select({ donorName: donations.donorName })
    .from(donations)
    .where(eq(donations.donorEmail, email))
    .limit(1);
  return donation?.donorName || 'Donor';
}

/**
 * Notify subscribed donors when a campaign is paused.
 */
export async function notifyCampaignPaused(p: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  reason: string;
  notifyDonors: boolean;
}) {
  if (!p.notifyDonors) return;

  const subscribers = await getSubscribedDonors(p.campaignId);

  for (const sub of subscribers) {
    const name = await resolveDonorName(sub.donorEmail);
    const emailContent = campaignPausedDonorEmail({
      donorName: name,
      campaignTitle: p.campaignTitle,
      campaignSlug: p.campaignSlug,
      reason: p.reason,
    });

    if (sub.userId) {
      await createAndEmail({
        userId: sub.userId,
        type: 'campaign_paused',
        title: `"${p.campaignTitle}" has been paused`,
        message: `The campaign has been temporarily paused. Reason: ${p.reason}`,
        link: `/campaigns/${p.campaignSlug}`,
        email: { to: sub.donorEmail, ...emailContent },
      });
    } else {
      await sendEmailOnly({ to: sub.donorEmail, ...emailContent });
    }
  }
}

/**
 * Notify subscribed donors when a campaign resumes.
 */
export async function notifyCampaignResumed(p: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
}) {
  const subscribers = await getSubscribedDonors(p.campaignId);

  for (const sub of subscribers) {
    const name = await resolveDonorName(sub.donorEmail);
    const emailContent = campaignResumedDonorEmail({
      donorName: name,
      campaignTitle: p.campaignTitle,
      campaignSlug: p.campaignSlug,
    });

    if (sub.userId) {
      await createAndEmail({
        userId: sub.userId,
        type: 'campaign_resumed',
        title: `"${p.campaignTitle}" has resumed`,
        message: `The campaign has resumed and is accepting donations again.`,
        link: `/campaigns/${p.campaignSlug}`,
        email: { to: sub.donorEmail, ...emailContent },
      });
    } else {
      await sendEmailOnly({ to: sub.donorEmail, ...emailContent });
    }
  }
}

/**
 * Notify subscribed donors when a campaign is suspended.
 */
export async function notifyCampaignSuspended(p: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
}) {
  const subscribers = await getSubscribedDonors(p.campaignId);

  for (const sub of subscribers) {
    const name = await resolveDonorName(sub.donorEmail);
    const emailContent = campaignSuspendedDonorEmail({
      donorName: name,
      campaignTitle: p.campaignTitle,
      campaignSlug: p.campaignSlug,
    });

    if (sub.userId) {
      await createAndEmail({
        userId: sub.userId,
        type: 'campaign_suspended',
        title: `"${p.campaignTitle}" has been suspended`,
        message: `The campaign has been suspended pending investigation. Your funds are secure.`,
        link: `/campaigns/${p.campaignSlug}`,
        email: { to: sub.donorEmail, ...emailContent },
      });
    } else {
      await sendEmailOnly({ to: sub.donorEmail, ...emailContent });
    }
  }
}

/**
 * Notify the campaigner about an info request.
 */
export async function notifyInfoRequest(p: {
  campaignerId: string;
  campaignerEmail: string;
  campaignerName: string;
  campaignId: string;
  campaignTitle: string;
  requestType: string;
  details: string;
  deadline: string;
}) {
  const emailContent = infoRequestCampaignerEmail({
    campaignerName: p.campaignerName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    requestType: p.requestType,
    details: p.details,
    deadline: p.deadline,
    campaignId: p.campaignId,
  });

  await createAndEmail({
    userId: p.campaignerId,
    type: 'info_request',
    title: `Action Required: Provide information for "${p.campaignTitle}"`,
    message: `Our verification team has requested additional information. Deadline: ${p.deadline}.`,
    link: `/dashboard/campaigns/${p.campaignId}/verification`,
    email: { to: p.campaignerEmail, ...emailContent },
  });
}

/**
 * Notify subscribed donors when a milestone is achieved.
 */
export async function notifyMilestoneAchieved(p: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  milestoneTitle: string;
  phaseNumber: number;
}) {
  const subscribers = await getSubscribedDonors(p.campaignId);

  for (const sub of subscribers) {
    const name = await resolveDonorName(sub.donorEmail);
    const emailContent = milestoneAchievedDonorEmail({
      donorName: name,
      campaignTitle: p.campaignTitle,
      campaignSlug: p.campaignSlug,
      milestoneTitle: p.milestoneTitle,
      phaseNumber: p.phaseNumber,
    });

    if (sub.userId) {
      await createAndEmail({
        userId: sub.userId,
        type: 'milestone_approved',
        title: `"${p.campaignTitle}" — Phase ${p.phaseNumber} achieved!`,
        message: `Milestone "${p.milestoneTitle}" has been verified.`,
        link: `/campaigns/${p.campaignSlug}`,
        email: { to: sub.donorEmail, ...emailContent },
      });
    } else {
      await sendEmailOnly({ to: sub.donorEmail, ...emailContent });
    }
  }
}

/**
 * Notify the campaigner that funds have been released.
 */
export async function notifyFundReleased(p: {
  campaignerId: string;
  campaignerEmail: string;
  campaignerName: string;
  campaignTitle: string;
  campaignSlug: string;
  phaseNumber: number;
  amount: number;
}) {
  const emailContent = fundReleasedEmail({
    campaignerName: p.campaignerName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    phaseNumber: p.phaseNumber,
    amount: p.amount,
  });

  await createAndEmail({
    userId: p.campaignerId,
    type: 'fund_released',
    title: `Phase ${p.phaseNumber} funds approved - $${(p.amount / 100).toFixed(2)}`,
    message: `Funds for Phase ${p.phaseNumber} of "${p.campaignTitle}" have been approved for release to your bank account.`,
    link: `/campaigns/${p.campaignSlug}`,
    email: { to: p.campaignerEmail, ...emailContent },
  });
}

/**
 * Notify the campaign creator that a milestone funding threshold has been reached.
 * During the campaign: celebration only — no evidence or verification requests.
 * Evidence submission is only requested post-completion.
 */
export async function notifyCreatorMilestoneReached(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignTitle: string;
  campaignSlug: string;
  milestoneTitle: string;
  phaseNumber: number;
  fundAmount: number;
}) {
  const emailContent = milestoneReachedCreatorEmail({
    campaignerName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
    milestoneTitle: p.milestoneTitle,
    phaseNumber: p.phaseNumber,
    fundAmount: p.fundAmount,
  });

  await createAndEmail({
    userId: p.creatorId,
    type: 'campaign_milestone',
    title: `Phase ${p.phaseNumber} funded! "${p.campaignTitle}"`,
    message: `Your campaign reached the funding target for Phase ${p.phaseNumber}: ${p.milestoneTitle}. Keep sharing to reach the next milestone!`,
    link: `/dashboard/campaigns/${p.campaignSlug}/milestones`,
    email: { to: p.creatorEmail, ...emailContent },
  });
}

/**
 * Notify all admins that a milestone funding threshold has been reached.
 * FYI only — no action required until campaign completes.
 */
export async function notifyAdminMilestoneReached(p: {
  campaignTitle: string;
  campaignSlug: string;
  milestoneTitle: string;
  phaseNumber: number;
  fundAmount: number;
  creatorName: string;
}) {
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'admin'));

  const emailContent = milestoneReachedAdminEmail({
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
    milestoneTitle: p.milestoneTitle,
    phaseNumber: p.phaseNumber,
    fundAmount: p.fundAmount,
    creatorName: p.creatorName,
  });

  for (const admin of admins) {
    await createAndEmail({
      userId: admin.id,
      type: 'campaign_milestone',
      title: `[Admin] Phase ${p.phaseNumber} funded — "${p.campaignTitle}"`,
      message: `Campaign "${p.campaignTitle}" reached Phase ${p.phaseNumber} funding target. Fund release after completion.`,
      link: `/admin/campaigns`,
      email: { to: admin.email, ...emailContent },
    });
  }
}

/**
 * Notify all admins that evidence has been submitted for a milestone.
 */
export async function notifyAdminEvidenceSubmitted(p: {
  campaignTitle: string;
  campaignSlug: string;
  milestoneTitle: string;
  phaseNumber: number;
  creatorName: string;
}) {
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'admin'));

  const emailContent = evidenceSubmittedAdminEmail({
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
    milestoneTitle: p.milestoneTitle,
    phaseNumber: p.phaseNumber,
    creatorName: p.creatorName,
  });

  for (const admin of admins) {
    await createAndEmail({
      userId: admin.id,
      type: 'campaign_milestone',
      title: `[Admin] Evidence submitted — Phase ${p.phaseNumber} of "${p.campaignTitle}"`,
      message: `${p.creatorName} submitted evidence for Phase ${p.phaseNumber}. Review required.`,
      link: `/admin/fund-releases`,
      email: { to: admin.email, ...emailContent },
    });
  }
}

/**
 * Send the welcome email to a new campaigner when their campaign goes live.
 * Focus: sharing and getting first donation — zero document requests.
 */
export async function notifyWelcomeCampaigner(p: {
  campaignerId: string;
  campaignerEmail: string;
  campaignerName: string;
  campaignTitle: string;
  campaignSlug: string;
}) {
  const emailContent = welcomeCampaignerEmail({
    campaignerName: p.campaignerName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
  });

  await createAndEmail({
    userId: p.campaignerId,
    type: 'campaign_submitted',
    title: `Your campaign "${p.campaignTitle}" is live!`,
    message: `Your campaign is now live and accepting donations. Share it to get your first donation!`,
    link: `/campaigns/${p.campaignSlug}`,
    email: { to: p.campaignerEmail, ...emailContent },
  });
}

/**
 * Notify admins when a bulk refund batch completes.
 */
export async function notifyBulkRefundCompleted(p: {
  campaignId: string;
  campaignTitle: string;
  totalDonors: number;
  totalAmount: number;
  failedCount: number;
}) {
  const admins = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.role, 'admin'));

  for (const admin of admins) {
    const emailContent = bulkRefundCompletedEmail({
      adminName: admin.name || 'Admin',
      campaignTitle: p.campaignTitle,
      totalDonors: p.totalDonors,
      totalAmount: p.totalAmount,
      failedCount: p.failedCount,
    });

    await createAndEmail({
      userId: admin.id,
      type: 'bulk_refund_processed',
      title: `Refund batch complete — "${p.campaignTitle}"`,
      message: `${p.totalDonors} donors refunded. Total: $${(p.totalAmount / 100).toFixed(2)}. ${p.failedCount} failed.`,
      link: `/admin/campaigns/${p.campaignId}`,
      email: { to: admin.email, ...emailContent },
    });
  }
}

// ─── Donation notifications ─────────────────────────────────────────────────

/**
 * Notify all admins when a donation is received.
 */
export async function notifyAdminsDonationReceived(p: {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  donorName: string;
  amount: number;
  isAnonymous: boolean;
  message?: string | null;
  excludeUserId?: string;
}) {
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'admin'));

  const donor = p.isAnonymous ? 'Anonymous' : p.donorName;
  const emailContent = donationReceivedEmail(p);

  for (const admin of admins) {
    // Skip if this admin is also the campaign creator (they get a separate, personalized notification)
    if (p.excludeUserId && admin.id === p.excludeUserId) continue;

    await createAndEmail({
      userId: admin.id,
      type: 'campaign_donation_received',
      title: `New donation: $${(p.amount / 100).toFixed(2)} to "${p.campaignTitle}"`,
      message: `${donor} donated $${(p.amount / 100).toFixed(2)} to "${p.campaignTitle}".${p.message ? ` Message: "${p.message}"` : ''}`,
      link: `/campaigns/${p.campaignSlug}`,
      email: { to: admin.email, ...emailContent },
    });
  }
}

/**
 * Notify the campaign creator when their campaign receives a donation.
 */
export async function notifyCreatorDonationReceived(p: {
  creatorId: string;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  donorName: string;
  amount: number;
  isAnonymous: boolean;
  message?: string | null;
}) {
  const [creator] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, p.creatorId))
    .limit(1);

  if (!creator) return;

  const donor = p.isAnonymous ? 'Anonymous' : p.donorName;

  await createAndEmail({
    userId: p.creatorId,
    type: 'campaign_donation_received',
    title: `New donation: $${(p.amount / 100).toFixed(2)}`,
    message: `${donor} donated $${(p.amount / 100).toFixed(2)} to your campaign "${p.campaignTitle}".${p.message ? ` They said: "${p.message}"` : ''}`,
    link: `/campaigns/${p.campaignSlug}`,
    email: {
      to: creator.email,
      subject: `You received a $${(p.amount / 100).toFixed(2)} donation!`,
      html: donationReceivedEmail(p).html,
    },
  });
}

// ─── New: Instant-live & post-completion notifications ──────────────────────

/**
 * Notify the campaign creator when they receive their FIRST donation.
 * Celebrates the milestone and requests banking details setup.
 */
export async function notifyCreatorFirstDonation(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignTitle: string;
  campaignSlug: string;
  donorName: string;
  amount: number;
  isAnonymous: boolean;
}) {
  const donor = p.isAnonymous ? 'An anonymous supporter' : p.donorName;
  const emailContent = firstDonationCelebrationEmail({
    campaignerName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
    donorName: donor,
    amount: p.amount,
  });

  await createAndEmail({
    userId: p.creatorId,
    type: 'campaign_donation_received',
    title: `First donation received! $${(p.amount / 100).toFixed(2)}`,
    message: `${donor} just made the first donation to your campaign "${p.campaignTitle}". You'll receive funds once your campaign completes and verification is done.`,
    link: `/campaigns/${p.campaignSlug}`,
    email: { to: p.creatorEmail, ...emailContent },
  });
}

/**
 * Notify the campaign creator that their campaign has been fully funded.
 * Requests verification documents with per-category requirements.
 * This is the START of the fund release process.
 */
export async function notifyCreatorCampaignCompleted(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignTitle: string;
  campaignSlug: string;
  goalAmount: number;
  donorCount: number;
  documentRequirementsHtml: string;
}) {
  const emailContent = campaignCompletedCreatorEmail({
    campaignerName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
    goalAmount: p.goalAmount,
    donorCount: p.donorCount,
    documentRequirementsHtml: p.documentRequirementsHtml,
  });

  await createAndEmail({
    userId: p.creatorId,
    type: 'campaign_completed',
    title: `Your campaign "${p.campaignTitle}" is fully funded!`,
    message: `Congratulations! Your campaign has reached its goal. Complete verification to start receiving funds.`,
    link: `/dashboard/campaigns/${p.campaignSlug}/milestones`,
    email: { to: p.creatorEmail, ...emailContent },
  });
}

/**
 * Send a verification reminder to the campaign creator.
 * Used in the escalating reminder system post-completion.
 */
export async function notifyVerificationReminder(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignTitle: string;
  campaignSlug: string;
  daysSinceCompletion: number;
  deadlineDays: number;
  urgencyLevel: 'gentle' | 'firm' | 'warning' | 'final';
}) {
  const emailContent = verificationReminderEmail({
    campaignerName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignSlug: p.campaignSlug,
    daysSinceCompletion: p.daysSinceCompletion,
    deadlineDays: p.deadlineDays,
    urgencyLevel: p.urgencyLevel,
  });

  // Use 'info_request' type for reminders — fits the existing notification category
  await createAndEmail({
    userId: p.creatorId,
    type: 'info_request',
    title: p.urgencyLevel === 'final'
      ? `Final Notice: Verify identity for "${p.campaignTitle}"`
      : `Reminder: Complete verification for "${p.campaignTitle}"`,
    message: `Your campaign was fully funded ${p.daysSinceCompletion} days ago. Complete verification to receive your funds. ${p.deadlineDays} days remaining.`,
    link: `/dashboard/campaigns/${p.campaignSlug}/verification`,
    email: { to: p.creatorEmail, ...emailContent },
  });
}

/**
 * Notify all admins when a creator submits verification documents for review.
 * Fires once per submission (not per document) to avoid notification flooding.
 */
export async function notifyAdminsVerificationSubmitted(p: {
  campaignId: string;
  campaignTitle: string;
  creatorName: string;
  documentCount: number;
}) {
  const admins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'admin'));

  const emailContent = verificationDocumentsAdminEmail(p);

  for (const admin of admins) {
    await createAndEmail({
      userId: admin.id,
      type: 'verification_documents_submitted',
      title: `[Verification] "${p.campaignTitle}" ready for review`,
      message: `${p.creatorName} submitted ${p.documentCount} verification document${p.documentCount === 1 ? '' : 's'}. Review required.`,
      link: `/admin/verification`,
      email: { to: admin.email, ...emailContent },
    });
  }
}

/**
 * Notify the campaign creator when their verification is approved (T1 or T2).
 */
export async function notifyCreatorVerificationApproved(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignId: string;
  campaignTitle: string;
  tier: 1 | 2;
}) {
  const emailContent = verificationApprovedCreatorEmail({
    creatorName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignId: p.campaignId,
    tier: p.tier,
  });

  const isFull = p.tier === 2;
  await createAndEmail({
    userId: p.creatorId,
    type: 'verification_approved',
    title: isFull
      ? `Your campaign is fully verified: "${p.campaignTitle}"`
      : `Identity verified for "${p.campaignTitle}"`,
    message: isFull
      ? `Congratulations! Your campaign has been fully verified and funds will be released according to your milestone schedule.`
      : `Your identity has been verified. Upload supporting documents to complete full verification.`,
    link: `/dashboard/campaigns/${p.campaignId}/verification`,
    email: { to: p.creatorEmail, ...emailContent },
  });
}

/**
 * Notify the campaign creator when their verification is rejected by an admin.
 */
export async function notifyCreatorVerificationRejected(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignId: string;
  campaignTitle: string;
  reason: string;
}) {
  const emailContent = verificationRejectedCreatorEmail({
    creatorName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    campaignId: p.campaignId,
    reason: p.reason,
  });

  await createAndEmail({
    userId: p.creatorId,
    type: 'verification_rejected',
    title: `Verification unsuccessful for "${p.campaignTitle}"`,
    message: `Your verification was not approved. Reason: ${p.reason}. You may resubmit from your verification dashboard.`,
    link: `/dashboard/campaigns/${p.campaignId}/verification`,
    email: { to: p.creatorEmail, ...emailContent },
  });
}

// ─── Withdrawal Notifications ───────────────────────────────────────────────

/**
 * Notify the campaign creator that their withdrawal has been completed.
 */
export async function notifyWithdrawalCompleted(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignTitle: string;
  amount: number;
  transferId: string;
}) {
  const emailContent = withdrawalCompletedEmail({
    campaignerName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    amount: p.amount,
    transferId: p.transferId,
  });

  await createAndEmail({
    userId: p.creatorId,
    type: 'withdrawal_completed',
    title: `Withdrawal of $${(p.amount / 100).toFixed(2)} completed`,
    message: `Your withdrawal from "${p.campaignTitle}" has been successfully processed.`,
    link: '/dashboard/payout-settings',
    email: { to: p.creatorEmail, ...emailContent },
  });
}

/**
 * Notify the campaign creator that their withdrawal has failed.
 */
export async function notifyWithdrawalFailed(p: {
  creatorId: string;
  creatorEmail: string;
  creatorName: string;
  campaignTitle: string;
  amount: number;
  reason: string;
}) {
  const emailContent = withdrawalFailedEmail({
    campaignerName: p.creatorName || 'Campaigner',
    campaignTitle: p.campaignTitle,
    amount: p.amount,
    reason: p.reason,
  });

  await createAndEmail({
    userId: p.creatorId,
    type: 'withdrawal_failed',
    title: `Withdrawal of $${(p.amount / 100).toFixed(2)} failed`,
    message: `Your withdrawal from "${p.campaignTitle}" could not be completed. ${p.reason}`,
    link: '/dashboard/payout-settings',
    email: { to: p.creatorEmail, ...emailContent },
  });
}
