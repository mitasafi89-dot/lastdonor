import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  campaigns,
  donations,
  users,
  blogPosts,
  newsletterSubscribers,
  newsItems,
  campaignUpdates,
  campaignSeedMessages,
  auditLogs,
  interactionLogs,
  donorRelationships,
  notifications,
  aiUsageLogs,
  fundPoolAllocations,
  campaignMessages,
  blogTopicQueue,
  blogGenerationLogs,
} from '@/db/schema';

export type Campaign = InferSelectModel<typeof campaigns>;
export type NewCampaign = InferInsertModel<typeof campaigns>;
export type Donation = InferSelectModel<typeof donations>;
export type NewDonation = InferInsertModel<typeof donations>;
export type User = InferSelectModel<typeof users>;
export type BlogPost = InferSelectModel<typeof blogPosts>;
export type NewBlogPost = InferInsertModel<typeof blogPosts>;
export type NewsletterSubscriber = InferSelectModel<typeof newsletterSubscribers>;
export type NewsItem = InferSelectModel<typeof newsItems>;
export type CampaignUpdate = InferSelectModel<typeof campaignUpdates>;
export type CampaignSeedMessage = InferSelectModel<typeof campaignSeedMessages>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type InteractionLog = InferSelectModel<typeof interactionLogs>;
export type DonorRelationship = InferSelectModel<typeof donorRelationships>;
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type AIUsageLog = InferSelectModel<typeof aiUsageLogs>;
export type FundPoolAllocation = InferSelectModel<typeof fundPoolAllocations>;
export type CampaignMessage = InferSelectModel<typeof campaignMessages>;
export type BlogTopic = InferSelectModel<typeof blogTopicQueue>;
export type NewBlogTopic = InferInsertModel<typeof blogTopicQueue>;
export type BlogGenerationLog = InferSelectModel<typeof blogGenerationLogs>;
export type NewBlogGenerationLog = InferInsertModel<typeof blogGenerationLogs>;

export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'last_donor_zone'
  | 'completed'
  | 'archived'
  | 'paused'
  | 'under_review'
  | 'suspended'
  | 'cancelled';

export type CampaignCategory =
  | 'medical'
  | 'disaster'
  | 'military'
  | 'veterans'
  | 'memorial'
  | 'first-responders'
  | 'community'
  | 'essential-needs'
  | 'emergency'
  | 'charity'
  | 'education'
  | 'animal'
  | 'environment'
  | 'business'
  | 'competition'
  | 'creative'
  | 'event'
  | 'faith'
  | 'family'
  | 'sports'
  | 'travel'
  | 'volunteer'
  | 'wishes';

export type DonationPhase =
  | 'first_believers'
  | 'the_push'
  | 'closing_in'
  | 'last_donor_zone';

export type UserRole = 'donor' | 'editor' | 'admin';

export type DonorType = 'individual' | 'corporate' | 'foundation';

export type InteractionType = 'email' | 'call' | 'meeting' | 'note';

export type NotificationType =
  | 'donation_refunded'
  | 'donation_refund_reversed'
  | 'campaign_completed'
  | 'campaign_archived'
  | 'campaign_status_changed'
  | 'role_changed'
  | 'account_deleted'
  | 'new_message'
  | 'message_flagged'
  | 'campaign_donation_received'
  | 'campaign_milestone'   // Donor count milestones (10, 25, 50, 100 donors) - actively used
  | 'campaign_message_received'
  | 'withdrawal_processed'
  | 'campaign_submitted'
  | 'campaign_paused'
  | 'campaign_resumed'
  | 'campaign_suspended'
  | 'campaign_cancelled'
  | 'info_request'
  | 'info_request_reminder'
  | 'milestone_approved'   // Legacy: kept for historical notifications (PG enum values cannot be removed)
  | 'milestone_rejected'   // Legacy: kept for historical notifications
  | 'fund_released'        // Legacy: replaced by lump-sum release via verification approval
  | 'verification_approved'
  | 'verification_rejected'
  | 'verification_documents_submitted'
  | 'bulk_refund_processed'
  | 'withdrawal_completed'
  | 'withdrawal_failed'
  | 'abandoned_donation'
  | 'donor_reengagement'
  | 'creator_inactivity';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export type WithdrawalStatus = 'requested' | 'approved' | 'completed' | 'rejected';

export type BeneficiaryRelation = 'self' | 'family' | 'friend' | 'community';

export type DonorAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

export type DonorScoreLevel = 'champion' | 'engaged' | 'warm' | 'cool' | 'cold';

export type ImpactTier = {
  amount: number;
  label: string;
};

/** Per-campaign simulation overrides stored as JSONB in campaigns.simulation_config. */
export type SimulationConfig = {
  paused: boolean;
  volumeOverride?: number;
  fundAllocation: 'pool' | 'located_beneficiary';
  beneficiaryInfo?: string;
  notes?: string;
  /** Persisted surge state: maps surge atPercent → cycle number when triggered. */
  surgeState?: Record<number, number>;
};

export type { TrajectoryProfile, TrajectoryType, AmountTier, SurgeEvent, SurgeState } from '@/lib/seed/trajectory-profiles';

export type {
  SimulatedDonor,
  AgeGroup,
  DonationBudget,
  MessageStyle,
} from '@/lib/seed/donor-pool';

export type {
  SelectedDonor,
  DonorCohort,
} from '@/lib/seed/donor-selector';

export type UserBadge = {
  type: string;
  campaignSlug: string;
  earnedAt: string;
};

export type CampaignOrganizer = {
  name: string;
  relation: string;
  city: string;
};

export type CampaignUpdateType =
  | 'phase_transition'
  | 'thank_you'
  | 'story_development'
  | 'disbursement_plan'
  | 'milestone_reflection'
  | 'community_response'
  | 'completion'
  | 'celebration'
  | 'impact_report';
