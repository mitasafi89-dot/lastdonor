/**
 * Per-category and per-relationship document requirements.
 *
 * Used post-completion when requesting verification documents from campaigners.
 * Requirements are specific to the campaign category and the relationship
 * between the organizer and the beneficiary to minimize friction and maximize
 * trust with donors.
 */

export type DocumentRequirement = {
  type: string;
  label: string;
  description: string;
  required: boolean;
};

export type CategoryRequirements = {
  label: string;
  documents: DocumentRequirement[];
};

export type RelationshipRequirements = {
  label: string;
  documents: DocumentRequirement[];
};

// ─── Per-category document requirements ───────────────────────────────────

const CATEGORY_DOCUMENTS: Record<string, CategoryRequirements> = {
  medical: {
    label: 'Medical',
    documents: [
      { type: 'hospital_letter', label: 'Medical documentation', description: 'Hospital letter, diagnosis, or treatment plan confirming the medical need', required: true },
      { type: 'receipt', label: 'Medical bills or cost estimate', description: 'Bills, invoices, or cost estimates from the healthcare provider', required: false },
    ],
  },
  disaster: {
    label: 'Disaster Relief',
    documents: [
      { type: 'official_letter', label: 'Incident documentation', description: 'Police report, insurance claim, or official disaster declaration', required: true },
      { type: 'other', label: 'Photos of damage', description: 'Photos showing the extent of damage or loss', required: false },
    ],
  },
  military: {
    label: 'Military',
    documents: [
      { type: 'official_letter', label: 'Military service proof', description: 'DD-214, military ID, or service verification letter', required: true },
    ],
  },
  veterans: {
    label: 'Veterans',
    documents: [
      { type: 'official_letter', label: 'Veteran status proof', description: 'DD-214, VA letter, or veteran organization membership', required: true },
    ],
  },
  memorial: {
    label: 'Memorial',
    documents: [
      { type: 'official_letter', label: 'Death certificate or obituary', description: 'Official documentation confirming the loss', required: true },
      { type: 'receipt', label: 'Funeral or memorial costs', description: 'Invoice or estimate from funeral home or memorial service', required: false },
    ],
  },
  'first-responders': {
    label: 'First Responders',
    documents: [
      { type: 'official_letter', label: 'Employment verification', description: 'Badge, department letter, or employment verification', required: true },
    ],
  },
  community: {
    label: 'Community',
    documents: [
      { type: 'other', label: 'Community need documentation', description: 'Photos, news articles, or community organization letter describing the need', required: false },
    ],
  },
  'essential-needs': {
    label: 'Essential Needs',
    documents: [
      { type: 'receipt', label: 'Cost documentation', description: 'Bills, invoices, or estimates for essential needs (housing, food, utilities)', required: true },
    ],
  },
  emergency: {
    label: 'Emergency',
    documents: [
      { type: 'official_letter', label: 'Emergency documentation', description: 'Police report, hospital records, or official emergency declaration', required: true },
    ],
  },
  charity: {
    label: 'Charity',
    documents: [
      { type: 'official_letter', label: 'Organization registration', description: '501(c)(3) letter, charity registration, or organizational documents', required: true },
    ],
  },
  education: {
    label: 'Education',
    documents: [
      { type: 'official_letter', label: 'Enrollment verification', description: 'Acceptance letter, enrollment confirmation, or student ID', required: true },
      { type: 'receipt', label: 'Tuition or education costs', description: 'Tuition invoice, book lists, or education cost breakdown', required: false },
    ],
  },
  animal: {
    label: 'Animal',
    documents: [
      { type: 'receipt', label: 'Veterinary documentation', description: 'Vet bills, treatment plans, or shelter documentation', required: true },
    ],
  },
  environment: {
    label: 'Environment',
    documents: [
      { type: 'other', label: 'Project plan', description: 'Environmental project proposal, permits, or organization letter', required: false },
    ],
  },
  business: {
    label: 'Business',
    documents: [
      { type: 'official_letter', label: 'Business registration', description: 'Business license, registration certificate, or articles of incorporation', required: true },
      { type: 'receipt', label: 'Business expenses', description: 'Invoices, quotes, or financial statements', required: false },
    ],
  },
  competition: {
    label: 'Competition',
    documents: [
      { type: 'official_letter', label: 'Competition entry proof', description: 'Registration confirmation, invitation letter, or competition details', required: true },
    ],
  },
  creative: {
    label: 'Creative',
    documents: [
      { type: 'other', label: 'Project portfolio', description: 'Work samples, project outline, or artist statement', required: false },
    ],
  },
  event: {
    label: 'Event',
    documents: [
      { type: 'receipt', label: 'Event costs', description: 'Venue booking, vendor quotes, or event budget', required: false },
    ],
  },
  faith: {
    label: 'Faith',
    documents: [
      { type: 'official_letter', label: 'Religious organization letter', description: 'Letter from religious leader, organization registration, or mission details', required: false },
    ],
  },
  family: {
    label: 'Family',
    documents: [
      { type: 'other', label: 'Supporting documentation', description: 'Photos, letters, or documentation supporting the family need', required: false },
    ],
  },
  sports: {
    label: 'Sports',
    documents: [
      { type: 'official_letter', label: 'Team or league membership', description: 'Team roster, league registration, or coach letter', required: false },
      { type: 'receipt', label: 'Equipment or travel costs', description: 'Invoices for equipment, travel, or training fees', required: false },
    ],
  },
  travel: {
    label: 'Travel',
    documents: [
      { type: 'receipt', label: 'Travel costs', description: 'Flight bookings, accommodation quotes, or travel itinerary', required: false },
    ],
  },
  volunteer: {
    label: 'Volunteer',
    documents: [
      { type: 'official_letter', label: 'Organization letter', description: 'Letter from the volunteer organization confirming the mission', required: true },
    ],
  },
  wishes: {
    label: 'Wishes',
    documents: [
      { type: 'other', label: 'Wish documentation', description: 'Description, quotes, or supporting documentation for the wish', required: false },
    ],
  },
};

// ─── Per-relationship document requirements ──────────────────────────────

const RELATIONSHIP_DOCUMENTS: Record<string, RelationshipRequirements> = {
  self: {
    label: 'Raising for yourself',
    documents: [
      { type: 'government_id', label: 'Government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
    ],
  },
  family: {
    label: 'Raising for a family member',
    documents: [
      { type: 'government_id', label: 'Your government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
      { type: 'other', label: 'Proof of relationship', description: 'Birth certificate, marriage certificate, or family documentation', required: false },
    ],
  },
  friend: {
    label: 'Raising for a friend',
    documents: [
      { type: 'government_id', label: 'Your government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
    ],
  },
  colleague: {
    label: 'Raising for a colleague',
    documents: [
      { type: 'government_id', label: 'Your government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
      { type: 'official_letter', label: 'Employment verification', description: 'Letter from employer or company ID confirming employment at the same organization', required: false },
    ],
  },
  community_member: {
    label: 'Raising for a community member',
    documents: [
      { type: 'government_id', label: 'Your government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
      { type: 'other', label: 'Community connection proof', description: 'Community organization membership, neighborhood association, or local leader endorsement', required: false },
    ],
  },
  organization: {
    label: 'Raising for an organization',
    documents: [
      { type: 'government_id', label: 'Your government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
      { type: 'official_letter', label: 'Authorization letter', description: 'Letter from the organization authorizing you to raise funds on their behalf', required: true },
      { type: 'official_letter', label: 'Organization registration', description: 'Business registration, 501(c)(3) letter, or organizational charter', required: true },
    ],
  },
  other: {
    label: 'Raising for someone else',
    documents: [
      { type: 'government_id', label: 'Your government-issued photo ID', description: 'Passport, driver\'s license, or national ID card', required: true },
      { type: 'selfie', label: 'Selfie with your ID', description: 'A clear photo of you holding your government ID', required: true },
      { type: 'other', label: 'Connection documentation', description: 'Any documentation showing your connection to the beneficiary', required: false },
    ],
  },
};

/**
 * Get the combined document requirements for a campaign based on its category
 * and the organizer's relationship to the beneficiary.
 *
 * Returns a deduplicated list with category-specific docs first, then
 * relationship-specific identity docs.
 */
export function getDocumentRequirements(
  category: string,
  beneficiaryRelation: string,
): { category: CategoryRequirements; relationship: RelationshipRequirements; combined: DocumentRequirement[] } {
  const categoryReqs = CATEGORY_DOCUMENTS[category] ?? {
    label: category,
    documents: [],
  };

  const relationReqs = RELATIONSHIP_DOCUMENTS[beneficiaryRelation] ?? RELATIONSHIP_DOCUMENTS.other!;

  // Combined: relationship docs first (identity), then category docs (proof of need)
  // Deduplicate by type+label
  const seen = new Set<string>();
  const combined: DocumentRequirement[] = [];

  for (const doc of [...relationReqs.documents, ...categoryReqs.documents]) {
    const key = `${doc.type}:${doc.label}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(doc);
    }
  }

  return { category: categoryReqs, relationship: relationReqs, combined };
}

/**
 * Format document requirements as a human-readable HTML list for emails.
 */
export function formatDocumentRequirementsHtml(
  category: string,
  beneficiaryRelation: string,
): string {
  const { combined } = getDocumentRequirements(category, beneficiaryRelation);

  if (combined.length === 0) {
    return '<li>Government-issued photo ID (passport, driver\'s license, or national ID)</li><li>A selfie holding your ID</li>';
  }

  return combined
    .map(
      (doc) =>
        `<li><strong>${doc.label}</strong>${doc.required ? ' (required)' : ' (if available)'} — ${doc.description}</li>`,
    )
    .join('\n');
}
