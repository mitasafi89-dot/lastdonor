import type { CampaignCategory } from '@/types';

/**
 * SEO content for each campaign category landing page.
 *
 * Every field is hand-written, grounded in Doc 18 pain-point research.
 * No AI-sounding language, no em dashes. Written for real people
 * who searched for something like "medical fundraiser" and landed here.
 */
export interface CategoryContent {
  /** URL slug (matches DB enum value) */
  slug: CampaignCategory;
  /** Human display name (same as CATEGORY_LABELS) */
  label: string;
  /** SEO page title (before "| LastDonor.org" suffix) */
  seoTitle: string;
  /** Meta description (155 chars max for SERP display) */
  metaDescription: string;
  /** H1 heading on the page */
  heading: string;
  /** Intro paragraph below heading (2-4 sentences, pain-point-driven) */
  intro: string;
  /** Short subtitle for OG image */
  ogSubtitle: string;
  /** JSON-LD description */
  jsonLdDescription: string;
  /** Hero image path relative to /public */
  heroImageUrl: string;
  /** Accessible alt text describing the hero image */
  heroImageAlt: string;
  /** Vecteezy attribution (photographer name) */
  heroImageAttribution: string;
}

export const CATEGORY_CONTENT: CategoryContent[] = [
  {
    slug: 'medical',
    label: 'Medical',
    seoTitle: 'Medical Fundraisers',
    metaDescription:
      'Reviewed medical fundraisers for patients, hospital bills, surgery costs, treatment, and family support. 0% platform fees.',
    heading: 'Medical Fundraisers',
    intro:
      'Medical emergencies do not wait for insurance approvals. When someone you love is in the hospital and the bills are already stacking up, a medical fundraiser needs to be clear, specific, and easy for donors to understand. Every medical campaign here is reviewed before publication, and donors can follow campaign progress and impact updates.',
    ogSubtitle: 'Reviewed campaigns for medical bills. 0% platform fees.',
    jsonLdDescription:
      'Reviewed medical fundraising campaigns on LastDonor.org for medical bills, surgery, treatment, and family support.',
    heroImageUrl: '/images/categories/medical-hero.webp',
    heroImageAlt: 'Child patient visiting doctor with mother in pediatric clinic',
    heroImageAttribution: 'Panchita Cotthan',
  },
  {
    slug: 'memorial',
    label: 'Memorial',
    seoTitle: 'Memorial & Funeral Fundraisers',
    metaDescription:
      'Help families cover funeral expenses, memorial funds, and grief support. Reviewed memorial fundraisers with 0% platform fees.',
    heading: 'Memorial & Funeral Fundraisers',
    intro:
      'Losing someone is hard enough without worrying about how to pay for the funeral. Funeral expenses, memorial services, travel, and family support can arrive all at once. Memorial fundraisers on LastDonor are reviewed before publication so donors can understand who the campaign supports and what the funds are intended to cover.',
    ogSubtitle: 'Help families say goodbye without financial stress.',
    jsonLdDescription:
      'Reviewed memorial and funeral fundraising campaigns on LastDonor.org with visible campaign progress.',
    heroImageUrl: '/images/categories/memorial-hero.webp',
    heroImageAlt: 'Day of the dead memorial flowers and candles',
    heroImageAttribution: 'Diluwar Nusen',
  },
  {
    slug: 'emergency',
    label: 'Emergency',
    seoTitle: 'Emergency Fundraisers',
    metaDescription:
      'Urgent emergency fundraisers for accidents, house fires, displacement, family crises, and essential needs. Reviewed before publication.',
    heading: 'Emergency Fundraisers',
    intro:
      'When everything goes wrong at once, a house fire, a car accident, a sudden job loss, people need help fast. Emergency campaigns here focus on a clear need, a specific goal, and details donors can review before they give.',
    ogSubtitle: 'Urgent help for people in crisis. Fast setup, fast payouts.',
    jsonLdDescription:
      'Emergency fundraising campaigns on LastDonor.org. Reviewed campaigns for urgent needs with 0% platform fees.',
    heroImageUrl: '/images/categories/emergency-hero.webp',
    heroImageAlt: 'Hurricane damage to a house with debris and scattered palm trees',
    heroImageAttribution: 'Asih Wahyuni',
  },
  {
    slug: 'charity',
    label: 'Charity',
    seoTitle: 'Charity Fundraisers',
    metaDescription:
      'Support charitable causes, community projects, and nonprofit fundraising with reviewed campaigns and visible donation progress.',
    heading: 'Charity Fundraisers',
    intro:
      'Most people want to give to charity but also want to understand where their money is going. Charity fundraisers on LastDonor explain the cause, the goal, and the intended use of funds before donors give.',
    ogSubtitle: 'Reviewed charity campaigns with visible progress.',
    jsonLdDescription:
      'Charity fundraising campaigns on LastDonor.org. Full transparency, zero platform fees, every dollar tracked.',
    heroImageUrl: '/images/categories/charity-hero.webp',
    heroImageAlt: 'Person in need sitting on the street',
    heroImageAttribution: 'Alexandre Faria',
  },
  {
    slug: 'education',
    label: 'Education',
    seoTitle: 'Education Fundraisers',
    metaDescription:
      'Fund tuition, books, school expenses, study abroad, and scholarships through reviewed education fundraisers.',
    heading: 'Education Fundraisers',
    intro:
      'College tuition, textbooks, study abroad trips, trade programs, and coding bootcamps can leave gaps that loans do not cover. Education fundraisers here explain the student, the school expense, and the fundraising goal so donors can review the need before giving.',
    ogSubtitle: 'Help real students cover the costs that loans do not.',
    jsonLdDescription:
      'Reviewed education fundraising campaigns on LastDonor.org for tuition, books, and school expenses.',
    heroImageUrl: '/images/categories/education-hero.webp',
    heroImageAlt: 'Boy in a yellow shirt with a backpack heading to school',
    heroImageAttribution: 'Narong Khuean',
  },
  {
    slug: 'animal',
    label: 'Animal',
    seoTitle: 'Animal & Pet Fundraisers',
    metaDescription:
      'Help cover vet bills, pet surgery, animal rescue operations, and shelter costs through reviewed animal fundraisers.',
    heading: 'Animal & Pet Fundraisers',
    intro:
      'A surprise vet bill can hit $5,000 or more overnight, and pet insurance does not cover everything. Animal rescue operations also run on tight budgets. Animal fundraisers here are reviewed before publication so donors can understand the pet, shelter, rescue, treatment estimate, or care plan.',
    ogSubtitle: 'Reviewed campaigns for vet bills, pets, and rescues.',
    jsonLdDescription:
      'Animal and pet fundraising campaigns on LastDonor.org. Reviewed fundraisers for vet bills, pet surgery, rescue work, and shelters.',
    heroImageUrl: '/images/categories/animal-hero.webp',
    heroImageAlt: 'Woman holding a puppy in an animal shelter',
    heroImageAttribution: 'Tatyana Makarova',
  },
  {
    slug: 'environment',
    label: 'Environment',
    seoTitle: 'Environmental Fundraisers',
    metaDescription:
      'Support conservation, cleanups, and sustainability projects through reviewed environmental fundraisers.',
    heading: 'Environmental Fundraisers',
    intro:
      'Beach cleanups, tree planting, wildlife conservation, community gardens. Environmental projects rarely get the funding they need because donors want clear plans and visible progress. Environmental fundraisers here explain the project, budget, and expected impact.',
    ogSubtitle: 'Conservation and sustainability campaigns. Full transparency.',
    jsonLdDescription:
      'Reviewed environmental fundraising campaigns on LastDonor.org for conservation, cleanups, and sustainability projects.',
    heroImageUrl: '/images/categories/environment-hero.webp',
    heroImageAlt: 'Mother teaching children to water seedlings in a garden',
    heroImageAttribution: 'Tinnakorn Jorruang',
  },
  {
    slug: 'business',
    label: 'Business',
    seoTitle: 'Small Business Fundraisers',
    metaDescription:
      'Help small businesses recover, launch, or survive through reviewed small business fundraisers.',
    heading: 'Small Business Fundraisers',
    intro:
      'A fire, a flood, a pandemic. Small business owners face emergencies that can wipe out everything they built. These campaigns help small business owners explain the need, the goal, and how funds are expected to be used.',
    ogSubtitle: 'Help small businesses survive and recover. Zero fees.',
    jsonLdDescription:
      'Reviewed small business fundraising campaigns on LastDonor.org with clear goals and visible progress.',
    heroImageUrl: '/images/categories/business-hero.webp',
    heroImageAlt: 'Business professionals collaborating in a modern office',
    heroImageAttribution: 'Benis Arapovic',
  },
  {
    slug: 'community',
    label: 'Community',
    seoTitle: 'Community Fundraisers',
    metaDescription:
      'Support local community projects, neighborhood improvements, and grassroots causes through reviewed fundraisers.',
    heading: 'Community Fundraisers',
    intro:
      'Park renovations, community centers, neighborhood safety projects, mutual aid. Local causes matter but they rarely go viral, so they get buried on large platforms. We surface community campaigns with clear goals, locations, and impact updates.',
    ogSubtitle: 'Local causes deserve real support. Zero platform fees.',
    jsonLdDescription:
      'Reviewed community fundraising campaigns on LastDonor.org for local causes and neighborhood projects.',
    heroImageUrl: '/images/categories/community-hero.webp',
    heroImageAlt: 'Group of community volunteers walking through a muddy field',
    heroImageAttribution: 'Yavhen Smyk',
  },
  {
    slug: 'competition',
    label: 'Competition',
    seoTitle: 'Competition & Tournament Fundraisers',
    metaDescription:
      'Fund competition entries, tournament travel, and team registrations through reviewed competition fundraisers.',
    heading: 'Competition & Tournament Fundraisers',
    intro:
      'Making it to nationals costs money. Registration fees, travel, gear, coaching. Talented people miss their shot because they cannot cover the entry costs. These campaigns help competitors get to where they need to be with a clear fundraising goal and visible campaign progress.',
    ogSubtitle: 'Help athletes and teams compete. Zero platform fees.',
    jsonLdDescription:
      'Competition and tournament fundraising campaigns on LastDonor.org. Zero platform fees.',
    heroImageUrl: '/images/categories/competition-hero.webp',
    heroImageAlt: 'Joyful young gymnast raising a trophy in a gym',
    heroImageAttribution: 'Lugon Stock',
  },
  {
    slug: 'creative',
    label: 'Creative',
    seoTitle: 'Creative Project Fundraisers',
    metaDescription:
      'Fund art projects, films, music, and creative work through reviewed creative project fundraisers.',
    heading: 'Creative Project Fundraisers',
    intro:
      'Albums, documentaries, art installations, community theater productions. Creative work takes money, and most artists do not have it. These campaigns fund creative projects with clear budgets, campaign updates, and visible progress.',
    ogSubtitle: 'Fund creative work with visible campaign progress.',
    jsonLdDescription:
      'Reviewed creative project fundraising campaigns on LastDonor.org with clear budgets and progress updates.',
    heroImageUrl: '/images/categories/creative-hero.webp',
    heroImageAlt: 'Fashion designer working with colorful fabric and materials',
    heroImageAttribution: 'Arcadesign',
  },
  {
    slug: 'event',
    label: 'Event',
    seoTitle: 'Event Fundraisers',
    metaDescription:
      'Raise money for community events, benefit concerts, and charitable gatherings through reviewed event fundraisers.',
    heading: 'Event Fundraisers',
    intro:
      'Benefit concerts, charity runs, community festivals, memorial events. Organizing something meaningful costs real money, venue fees, permits, supplies. These campaigns help event organizers raise what they need with complete transparency. No surprise platform fees reducing your event budget.',
    ogSubtitle: 'Fund meaningful community events. Zero platform fees.',
    jsonLdDescription:
      'Reviewed event fundraising campaigns on LastDonor.org for benefit concerts, gatherings, and community events.',
    heroImageUrl: '/images/categories/event-hero.webp',
    heroImageAlt: 'Group of people celebrating at a festive New Year party',
    heroImageAttribution: 'Myron Standret',
  },
  {
    slug: 'faith',
    label: 'Faith',
    seoTitle: 'Faith-Based Fundraisers',
    metaDescription:
      'Support church projects, mission trips, ministry work, and faith-based community needs through reviewed fundraisers.',
    heading: 'Faith-Based Fundraisers',
    intro:
      'Church building funds, mission trips, ministry projects, and refugee assistance through faith organizations all need clear fundraising pages. Faith-based campaigns on LastDonor are reviewed before publication so donors can understand the mission, goal, and intended use of funds.',
    ogSubtitle: 'Support churches and ministries. Zero platform fees.',
    jsonLdDescription:
      'Reviewed faith-based fundraising campaigns on LastDonor.org for church projects, mission trips, and ministry work.',
    heroImageUrl: '/images/categories/faith-hero.webp',
    heroImageAlt: 'Silhouette of person celebrating sunrise over a mountain range',
    heroImageAttribution: 'Oleg Gapeenko',
  },
  {
    slug: 'family',
    label: 'Family',
    seoTitle: 'Family Fundraisers',
    metaDescription:
      'Help families facing emergencies, adoption costs, rent, bills, housing, and hardship through reviewed family fundraisers.',
    heading: 'Family Fundraisers',
    intro:
      'Adoption costs, family emergencies, a parent who lost a job, a house that burned down. Families in crisis need a fundraiser that explains the need plainly and gives donors confidence before they give. Family campaigns here are reviewed before publication and organized around a clear goal.',
    ogSubtitle: 'Help families with reviewed fundraisers and clear goals.',
    jsonLdDescription:
      'Reviewed family fundraising campaigns on LastDonor.org for emergencies, bills, housing, and hardship.',
    heroImageUrl: '/images/categories/family-hero.webp',
    heroImageAlt: 'African American family posing together for a portrait',
    heroImageAttribution: 'Dichlonius1337',
  },
  {
    slug: 'sports',
    label: 'Sports',
    seoTitle: 'Sports Fundraisers',
    metaDescription:
      'Fund team travel, equipment, and youth athletics through reviewed sports fundraisers.',
    heading: 'Sports Fundraisers',
    intro:
      'Youth leagues, club teams, individual athletes training for something big. Sports costs add up fast, uniforms, travel, tournament fees, and coaching. These campaigns help athletes and teams raise what they need with a clear budget and visible progress.',
    ogSubtitle: 'Fund athletes and teams. Zero platform fees.',
    jsonLdDescription:
      'Reviewed sports fundraising campaigns on LastDonor.org for teams, athletes, equipment, and travel.',
    heroImageUrl: '/images/categories/sports-hero.webp',
    heroImageAlt: 'American football players in action during a game',
    heroImageAttribution: 'Denis Arapovic',
  },
  {
    slug: 'travel',
    label: 'Travel',
    seoTitle: 'Travel Fundraisers',
    metaDescription:
      'Fund mission trips, volunteer travel, medical brigades, educational exchanges, and meaningful journeys through reviewed campaigns.',
    heading: 'Travel Fundraisers',
    intro:
      'Volunteer abroad programs, mission trips, medical brigades in underserved areas, educational exchanges. Not every trip is a vacation. Some travel changes lives, and these campaigns help people get where they need to go. We verify every travel campaign to make sure donors know exactly what they are funding.',
    ogSubtitle: 'Fund travel that matters through reviewed campaigns.',
    jsonLdDescription:
      'Reviewed travel fundraising campaigns on LastDonor.org for mission trips, volunteer travel, and educational exchanges.',
    heroImageUrl: '/images/categories/travel-hero.webp',
    heroImageAlt: 'Male traveler setting up camp near his tent in the wilderness',
    heroImageAttribution: 'Kanokpol Prasankh',
  },
  {
    slug: 'volunteer',
    label: 'Volunteer',
    seoTitle: 'Volunteer Fundraisers',
    metaDescription:
      'Fund volunteer projects, community service, and nonprofit work through reviewed volunteer fundraisers.',
    heading: 'Volunteer Fundraisers',
    intro:
      'Volunteers give their time, but projects still cost money. Supplies, transportation, equipment, meals for work crews. These campaigns fund the material side of volunteer work with clear goals and visible progress.',
    ogSubtitle: 'Fund volunteer projects and community service. Zero fees.',
    jsonLdDescription:
      'Reviewed volunteer fundraising campaigns on LastDonor.org for community service and nonprofit projects.',
    heroImageUrl: '/images/categories/volunteer-hero.webp',
    heroImageAlt: 'Group of volunteers raising their hands together in solidarity',
    heroImageAttribution: 'Kanokpol Prasankh',
  },
  {
    slug: 'wishes',
    label: 'Wishes',
    seoTitle: 'Wish Fundraisers',
    metaDescription:
      'Help make meaningful wishes possible through reviewed personal fundraisers with clear goals and visible progress.',
    heading: 'Wish Fundraisers',
    intro:
      'A grandmother who wants to visit her birthplace one last time. A kid on the spectrum who dreams of going to space camp. A veteran who wants to see his old unit. Some wishes are worth funding, and these campaigns make them real. We verify every wish campaign so your generosity goes to someone who genuinely needs a hand.',
    ogSubtitle: 'Make meaningful wishes possible through reviewed fundraisers.',
    jsonLdDescription:
      'Reviewed wish fundraising campaigns on LastDonor.org with clear goals and visible progress.',
    heroImageUrl: '/images/categories/wishes-hero.webp',
    heroImageAlt: 'Man remembering something meaningful while looking into the distance',
    heroImageAttribution: 'Viorel Kurnosov',
  },
  // Legacy categories (still have active campaigns)
  {
    slug: 'military',
    label: 'Military',
    seoTitle: 'Military Fundraisers',
    metaDescription:
      'Support active-duty military families and service members through reviewed military fundraisers.',
    heading: 'Military Fundraisers',
    intro:
      'Deployments, relocations, equipment not covered by the government, families left behind. Military service comes with costs that most people never see. Military fundraisers here focus on the service member or family, the specific need, and the fundraising goal donors are being asked to support.',
    ogSubtitle: 'Support military families. Zero platform fees.',
    jsonLdDescription:
      'Reviewed military fundraising campaigns on LastDonor.org for service members and families.',
    heroImageUrl: '/images/categories/military-hero.webp',
    heroImageAlt: 'Smiling soldier hugging a happy child with American flag decorations',
    heroImageAttribution: 'Tatyana Makarova',
  },
  {
    slug: 'veterans',
    label: 'Veterans',
    seoTitle: 'Veteran Fundraisers',
    metaDescription:
      'Help veterans with medical care, housing, transition support, essential needs, and family emergencies through reviewed fundraisers.',
    heading: 'Veteran Fundraisers',
    intro:
      'The VA does not cover everything. Housing, mental health care, prosthetics, job retraining, and family emergencies can create urgent gaps. Veteran fundraisers here are reviewed before publication and organized around clear goals with 0% platform fees.',
    ogSubtitle: 'Support veterans through reviewed fundraisers.',
    jsonLdDescription:
      'Reviewed veteran fundraising campaigns on LastDonor.org for medical care, housing, and transition support.',
    heroImageUrl: '/images/categories/veterans-hero.webp',
    heroImageAlt: 'Man and woman in orange vests helping a veteran',
    heroImageAttribution: 'Roman Bulatov',
  },
  {
    slug: 'first-responders',
    label: 'First Responders',
    seoTitle: 'First Responder Fundraisers',
    metaDescription:
      'Support firefighters, paramedics, and first responders through reviewed fundraisers.',
    heading: 'First Responder Fundraisers',
    intro:
      'Firefighters, paramedics, EMTs, search and rescue volunteers. They run toward danger, and when they get hurt or their families need help, their fundraisers deserve clear context, respectful wording, and visible progress for donors.',
    ogSubtitle: 'Support the people who run toward danger. Zero fees.',
    jsonLdDescription:
      'Reviewed first responder fundraising campaigns on LastDonor.org for firefighters, paramedics, EMTs, and families.',
    heroImageUrl: '/images/categories/first-responders-hero.webp',
    heroImageAlt: 'Group of firefighters in protective uniforms at their station',
    heroImageAttribution: 'myron Standret',
  },
  {
    slug: 'disaster',
    label: 'Disaster Relief',
    seoTitle: 'Disaster Relief Fundraisers',
    metaDescription:
      'Help disaster victims recover from wildfires, floods, tornadoes, hurricanes, and house fires through reviewed fundraisers.',
    heading: 'Disaster Relief Fundraisers',
    intro:
      'Hurricanes, wildfires, floods, tornadoes. When disaster hits, donors want to support real recovery needs and understand how money will help. Disaster relief fundraisers here explain the event, location, people affected, and specific costs.',
    ogSubtitle: 'Reviewed disaster relief fundraisers with clear goals.',
    jsonLdDescription:
      'Reviewed disaster relief fundraising campaigns on LastDonor.org for wildfires, floods, tornadoes, hurricanes, and house fires.',
    heroImageUrl: '/images/categories/disaster-hero.webp',
    heroImageAlt: 'Hurricane damage to a house with debris and scattered palm trees',
    heroImageAttribution: 'Asih Wahyuni',
  },
  {
    slug: 'essential-needs',
    label: 'Essential Needs',
    seoTitle: 'Essential Needs Fundraisers',
    metaDescription:
      'Help people cover rent, food, utilities, transportation, clothing, and basic needs through reviewed fundraisers.',
    heading: 'Essential Needs Fundraisers',
    intro:
      'Rent, groceries, utility bills, clothing for kids. Sometimes people need help with the basics, and there is no shame in that. These campaigns are for people who are one paycheck away from losing everything and just need a bridge to get through. We verify every campaign and there are zero platform fees, because taking a cut from someone who cannot afford groceries is not something we will do.',
    ogSubtitle: 'Help cover the basics through reviewed fundraisers.',
    jsonLdDescription:
      'Reviewed essential needs fundraising campaigns on LastDonor.org for rent, food, utilities, and basic needs.',
    heroImageUrl: '/images/categories/essential-needs-hero.webp',
    heroImageAlt: 'Diverse team of volunteer workers providing essential aid',
    heroImageAttribution: 'Akarawut Lohachar',
  },
];

/** Look up category content by slug. Returns undefined for unknown slugs. */
export function getCategoryContent(slug: string): CategoryContent | undefined {
  return CATEGORY_CONTENT.find((c) => c.slug === slug);
}

/** All valid category slugs for generateStaticParams. */
export const ALL_CATEGORY_SLUGS = CATEGORY_CONTENT.map((c) => c.slug);
