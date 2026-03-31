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
      'Verified medical fundraisers for real patients. No hidden tips, no surprise fees. Every campaign is verified by a real person.',
    heading: 'Medical Fundraisers',
    intro:
      'Medical emergencies do not wait for insurance approvals. When someone you love is in the hospital and the bills are already stacking up, the last thing you need is a fundraising platform skimming tips off the top. Every medical campaign here is verified by a real person. Your donation goes directly to the patient or their family, and you can see exactly where it went.',
    ogSubtitle: 'Verified campaigns for real patients. 0% platform fees.',
    jsonLdDescription:
      'Verified medical fundraising campaigns on LastDonor.org. Zero platform fees, every campaign verified by a real person.',
    heroImageUrl: '/images/categories/medical-hero.webp',
    heroImageAlt: 'Child patient visiting doctor with mother in pediatric clinic',
    heroImageAttribution: 'Panchita Cotthan',
  },
  {
    slug: 'memorial',
    label: 'Memorial',
    seoTitle: 'Memorial & Funeral Fundraisers',
    metaDescription:
      'Help families cover funeral and memorial costs. Every campaign verified. No hidden fees, no delays when families need help most.',
    heading: 'Memorial & Funeral Fundraisers',
    intro:
      'Losing someone is hard enough without worrying about how to pay for the funeral. Average funeral costs in the US run between $7,000 and $12,000, and most families have days, not weeks, to come up with it. We verify every memorial campaign quickly because we know time matters. There are no surprise tips added to your donation, and families get their funds without the runaround.',
    ogSubtitle: 'Help families say goodbye without financial stress.',
    jsonLdDescription:
      'Memorial and funeral fundraising campaigns on LastDonor.org. Verified, transparent, zero platform fees.',
    heroImageUrl: '/images/categories/memorial-hero.webp',
    heroImageAlt: 'Day of the dead memorial flowers and candles',
    heroImageAttribution: 'Diluwar Nusen',
  },
  {
    slug: 'emergency',
    label: 'Emergency',
    seoTitle: 'Emergency Fundraisers',
    metaDescription:
      'Urgent fundraising for people in crisis right now. Fast setup, fast payouts, zero hidden fees. Every emergency campaign is verified.',
    heading: 'Emergency Fundraisers',
    intro:
      'When everything goes wrong at once, a house fire, a car accident, a sudden job loss, people need money fast. Not next week. Not after a 5-day identity verification process. Emergency campaigns here go through rapid verification so funds can move quickly. We do not add hidden tips to your donation, and we do not hold funds hostage while someone is sleeping in their car.',
    ogSubtitle: 'Urgent help for people in crisis. Fast setup, fast payouts.',
    jsonLdDescription:
      'Emergency fundraising campaigns on LastDonor.org. Rapid verification, zero hidden fees, fast payouts.',
    heroImageUrl: '/images/categories/emergency-hero.webp',
    heroImageAlt: 'Hurricane damage to a house with debris and scattered palm trees',
    heroImageAttribution: 'Asih Wahyuni',
  },
  {
    slug: 'charity',
    label: 'Charity',
    seoTitle: 'Charity Fundraisers',
    metaDescription:
      'Support charitable causes with full transparency. No hidden fees, no tip sliders. See exactly where every dollar goes.',
    heading: 'Charity Fundraisers',
    intro:
      'Most people want to give to charity but have no idea where their money actually ends up. On other platforms, a pre-checked tip slider quietly adds 15% or more to your donation before you even notice. Here, what you give is what the cause receives. Every charity campaign is verified, every dollar is tracked, and you can see exactly how funds are being used.',
    ogSubtitle: 'Full transparency. No tip sliders. Every dollar tracked.',
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
      'Fund tuition, books, study abroad, and scholarships. Verified education campaigns with zero hidden fees.',
    heading: 'Education Fundraisers',
    intro:
      'College tuition, textbooks, study abroad trips, coding bootcamps. Education costs keep climbing and student loans do not cover everything. These campaigns help real students fill the gaps. We verify every education campaign so donors know their money is going to an actual student with an actual need, not someone gaming the system.',
    ogSubtitle: 'Help real students cover the costs that loans do not.',
    jsonLdDescription:
      'Education fundraising campaigns on LastDonor.org. Verified students, zero platform fees.',
    heroImageUrl: '/images/categories/education-hero.webp',
    heroImageAlt: 'Boy in a yellow shirt with a backpack heading to school',
    heroImageAttribution: 'Narong Khuean',
  },
  {
    slug: 'animal',
    label: 'Animal',
    seoTitle: 'Animal & Pet Fundraisers',
    metaDescription:
      'Help cover vet bills, rescue operations, and shelter costs. Every animal campaign verified to prevent fraud.',
    heading: 'Animal & Pet Fundraisers',
    intro:
      'A surprise vet bill can hit $5,000 or more overnight, and pet insurance does not cover everything. Animal rescue operations run on almost nothing. Unfortunately, fake pet campaigns are one of the most common scams on other platforms. We verify every animal campaign here so your donation actually goes to the dog that needs surgery, or the shelter that is about to close its doors.',
    ogSubtitle: 'Verified campaigns for real animals. No scams, no hidden fees.',
    jsonLdDescription:
      'Animal and pet fundraising campaigns on LastDonor.org. Verified to prevent fraud, zero platform fees.',
    heroImageUrl: '/images/categories/animal-hero.webp',
    heroImageAlt: 'Woman holding a puppy in an animal shelter',
    heroImageAttribution: 'Tatyana Makarova',
  },
  {
    slug: 'environment',
    label: 'Environment',
    seoTitle: 'Environmental Fundraisers',
    metaDescription:
      'Support conservation, cleanups, and sustainability projects. Verified environmental campaigns with full transparency.',
    heading: 'Environmental Fundraisers',
    intro:
      'Beach cleanups, tree planting, wildlife conservation, community gardens. Environmental projects rarely get the funding they need because people worry about where the money actually goes. Every environmental campaign here shows you exactly how funds are allocated. No hidden fees diluting your impact.',
    ogSubtitle: 'Conservation and sustainability campaigns. Full transparency.',
    jsonLdDescription:
      'Environmental fundraising campaigns on LastDonor.org. Verified projects, zero platform fees.',
    heroImageUrl: '/images/categories/environment-hero.webp',
    heroImageAlt: 'Mother teaching children to water seedlings in a garden',
    heroImageAttribution: 'Tinnakorn Jorruang',
  },
  {
    slug: 'business',
    label: 'Business',
    seoTitle: 'Small Business Fundraisers',
    metaDescription:
      'Help small businesses recover, launch, or survive. Verified business campaigns with zero platform fees.',
    heading: 'Small Business Fundraisers',
    intro:
      'A fire, a flood, a pandemic. Small business owners face emergencies that can wipe out everything they built. Most crowdfunding platforms are designed for personal causes, not businesses. These campaigns help real small business owners get back on their feet with verified stories and full transparency on how funds are used.',
    ogSubtitle: 'Help small businesses survive and recover. Zero fees.',
    jsonLdDescription:
      'Small business fundraising campaigns on LastDonor.org. Verified stories, zero platform fees.',
    heroImageUrl: '/images/categories/business-hero.webp',
    heroImageAlt: 'Business professionals collaborating in a modern office',
    heroImageAttribution: 'Benis Arapovic',
  },
  {
    slug: 'community',
    label: 'Community',
    seoTitle: 'Community Fundraisers',
    metaDescription:
      'Support local community projects, neighborhood improvements, and grassroots causes. Every campaign verified.',
    heading: 'Community Fundraisers',
    intro:
      'Park renovations, community centers, neighborhood safety projects, mutual aid. Local causes matter but they rarely go viral, so they get buried on the big platforms. We surface community campaigns because they deserve the same visibility as any other cause. Every one is verified, and every dollar you give goes to the community, not to our pockets.',
    ogSubtitle: 'Local causes deserve real support. Zero platform fees.',
    jsonLdDescription:
      'Community fundraising campaigns on LastDonor.org. Verified local causes, zero platform fees.',
    heroImageUrl: '/images/categories/community-hero.webp',
    heroImageAlt: 'Group of community volunteers walking through a muddy field',
    heroImageAttribution: 'Yavhen Smyk',
  },
  {
    slug: 'competition',
    label: 'Competition',
    seoTitle: 'Competition & Tournament Fundraisers',
    metaDescription:
      'Fund competition entries, tournament travel, and team registrations. Verified campaigns with zero fees.',
    heading: 'Competition & Tournament Fundraisers',
    intro:
      'Making it to nationals costs money. Registration fees, travel, gear, coaching. Talented people miss their shot because they cannot cover the entry costs. These campaigns help competitors get to where they need to be. We verify every one, and there are no hidden platform fees eating into what your team or athlete actually receives.',
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
      'Fund art projects, films, music, and creative work. Verified campaigns with zero platform fees.',
    heading: 'Creative Project Fundraisers',
    intro:
      'Albums, documentaries, art installations, community theater productions. Creative work takes money, and most artists do not have it. These campaigns fund real creative projects with full transparency on how the money is spent. No hidden tips siphoned off the top. What your community gives, the artist receives.',
    ogSubtitle: 'Fund real creative work. Zero hidden fees.',
    jsonLdDescription:
      'Creative project fundraising campaigns on LastDonor.org. Verified projects, zero platform fees.',
    heroImageUrl: '/images/categories/creative-hero.webp',
    heroImageAlt: 'Fashion designer working with colorful fabric and materials',
    heroImageAttribution: 'Arcadesign',
  },
  {
    slug: 'event',
    label: 'Event',
    seoTitle: 'Event Fundraisers',
    metaDescription:
      'Raise money for community events, benefit concerts, and charitable gatherings. Verified with zero fees.',
    heading: 'Event Fundraisers',
    intro:
      'Benefit concerts, charity runs, community festivals, memorial events. Organizing something meaningful costs real money, venue fees, permits, supplies. These campaigns help event organizers raise what they need with complete transparency. No surprise platform fees reducing your event budget.',
    ogSubtitle: 'Fund meaningful community events. Zero platform fees.',
    jsonLdDescription:
      'Event fundraising campaigns on LastDonor.org. Verified events, zero platform fees.',
    heroImageUrl: '/images/categories/event-hero.webp',
    heroImageAlt: 'Group of people celebrating at a festive New Year party',
    heroImageAttribution: 'Myron Standret',
  },
  {
    slug: 'faith',
    label: 'Faith',
    seoTitle: 'Faith-Based Fundraisers',
    metaDescription:
      'Support church projects, mission trips, and ministry work. Verified campaigns with zero hidden fees.',
    heading: 'Faith-Based Fundraisers',
    intro:
      'Church building funds, mission trips, ministry projects, refugee assistance through faith organizations. Faith communities are generous givers, but other platforms have restricted or removed faith-based campaigns without explanation. We verify every campaign and we do not discriminate by denomination or belief. Your congregation gives, and the mission receives it all.',
    ogSubtitle: 'Support churches and ministries. Zero platform fees.',
    jsonLdDescription:
      'Faith-based fundraising campaigns on LastDonor.org. Verified, non-discriminatory, zero platform fees.',
    heroImageUrl: '/images/categories/faith-hero.webp',
    heroImageAlt: 'Silhouette of person celebrating sunrise over a mountain range',
    heroImageAttribution: 'Oleg Gapeenko',
  },
  {
    slug: 'family',
    label: 'Family',
    seoTitle: 'Family Fundraisers',
    metaDescription:
      'Help families facing emergencies, adoption costs, or hardship. Every campaign verified. Zero hidden fees.',
    heading: 'Family Fundraisers',
    intro:
      'Adoption costs, family emergencies, a parent who lost their job, a house that burned down. Families in crisis need help fast, and the last thing they need is a platform that holds their funds for weeks or sneaks in a 15% tip on every donation. Every family campaign here is verified by a real person, and families get access to their funds without the nightmare withdrawal process other platforms are known for.',
    ogSubtitle: 'Help real families in real need. Zero hidden fees.',
    jsonLdDescription:
      'Family fundraising campaigns on LastDonor.org. Verified, fast payouts, zero platform fees.',
    heroImageUrl: '/images/categories/family-hero.webp',
    heroImageAlt: 'African American family posing together for a portrait',
    heroImageAttribution: 'Dichlonius1337',
  },
  {
    slug: 'sports',
    label: 'Sports',
    seoTitle: 'Sports Fundraisers',
    metaDescription:
      'Fund team travel, equipment, and youth athletics. Verified sports campaigns with zero platform fees.',
    heading: 'Sports Fundraisers',
    intro:
      'Youth leagues, club teams, individual athletes training for something big. Sports costs add up fast, uniforms, travel, tournament fees, and coaching. These campaigns help athletes and teams raise what they need with full transparency. No hidden charges reducing the amount your team actually gets.',
    ogSubtitle: 'Fund athletes and teams. Zero platform fees.',
    jsonLdDescription:
      'Sports fundraising campaigns on LastDonor.org. Verified teams and athletes, zero platform fees.',
    heroImageUrl: '/images/categories/sports-hero.webp',
    heroImageAlt: 'American football players in action during a game',
    heroImageAttribution: 'Denis Arapovic',
  },
  {
    slug: 'travel',
    label: 'Travel',
    seoTitle: 'Travel Fundraisers',
    metaDescription:
      'Fund mission trips, volunteer travel, and meaningful journeys. Verified campaigns with zero hidden fees.',
    heading: 'Travel Fundraisers',
    intro:
      'Volunteer abroad programs, mission trips, medical brigades in underserved areas, educational exchanges. Not every trip is a vacation. Some travel changes lives, and these campaigns help people get where they need to go. We verify every travel campaign to make sure donors know exactly what they are funding.',
    ogSubtitle: 'Fund travel that matters. Verified campaigns, zero fees.',
    jsonLdDescription:
      'Travel fundraising campaigns on LastDonor.org. Verified trips, zero platform fees.',
    heroImageUrl: '/images/categories/travel-hero.webp',
    heroImageAlt: 'Male traveler setting up camp near his tent in the wilderness',
    heroImageAttribution: 'Kanokpol Prasankh',
  },
  {
    slug: 'volunteer',
    label: 'Volunteer',
    seoTitle: 'Volunteer Fundraisers',
    metaDescription:
      'Fund volunteer projects, community service, and nonprofit work. Verified campaigns with zero fees.',
    heading: 'Volunteer Fundraisers',
    intro:
      'Volunteers give their time, but projects still cost money. Supplies, transportation, equipment, meals for work crews. These campaigns fund the material side of volunteer work so people can focus on the actual helping. Every campaign is verified, and your donation goes entirely to the project.',
    ogSubtitle: 'Fund volunteer projects and community service. Zero fees.',
    jsonLdDescription:
      'Volunteer fundraising campaigns on LastDonor.org. Verified projects, zero platform fees.',
    heroImageUrl: '/images/categories/volunteer-hero.webp',
    heroImageAlt: 'Group of volunteers raising their hands together in solidarity',
    heroImageAttribution: 'Kanokpol Prasankh',
  },
  {
    slug: 'wishes',
    label: 'Wishes',
    seoTitle: 'Wish Fundraisers',
    metaDescription:
      'Help make meaningful wishes come true for people who deserve it. Verified campaigns with zero hidden fees.',
    heading: 'Wish Fundraisers',
    intro:
      'A grandmother who wants to visit her birthplace one last time. A kid on the spectrum who dreams of going to space camp. A veteran who wants to see his old unit. Some wishes are worth funding, and these campaigns make them real. We verify every wish campaign so your generosity goes to someone who genuinely needs a hand.',
    ogSubtitle: 'Make meaningful wishes come true. Verified, zero fees.',
    jsonLdDescription:
      'Wish fundraising campaigns on LastDonor.org. Verified wishes, zero platform fees.',
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
      'Support active-duty military families and service members. Verified campaigns with zero platform fees.',
    heading: 'Military Fundraisers',
    intro:
      'Deployments, relocations, equipment not covered by the government, families left behind. Military service comes with costs that most people never see. Other platforms have removed military campaigns over political pressure. We do not do that. Every military campaign here is verified, and your donation goes directly to the service member or their family.',
    ogSubtitle: 'Support military families. Zero platform fees.',
    jsonLdDescription:
      'Military fundraising campaigns on LastDonor.org. Verified, zero platform fees.',
    heroImageUrl: '/images/categories/military-hero.webp',
    heroImageAlt: 'Smiling soldier hugging a happy child with American flag decorations',
    heroImageAttribution: 'Tatyana Makarova',
  },
  {
    slug: 'veterans',
    label: 'Veterans',
    seoTitle: 'Veteran Fundraisers',
    metaDescription:
      'Help veterans with medical care, housing, and transition support. Verified campaigns with zero hidden fees.',
    heading: 'Veteran Fundraisers',
    intro:
      'The VA does not cover everything. Housing, mental health care, prosthetics, job retraining. Veterans who served their country deserve a fundraising platform that does not skim tips off donations meant for them. Every veteran campaign here is verified by a real person, and there are zero platform fees.',
    ogSubtitle: 'Veterans deserve better. Zero fees, verified campaigns.',
    jsonLdDescription:
      'Veteran fundraising campaigns on LastDonor.org. Verified, zero platform fees.',
    heroImageUrl: '/images/categories/veterans-hero.webp',
    heroImageAlt: 'Man and woman in orange vests helping a veteran',
    heroImageAttribution: 'Roman Bulatov',
  },
  {
    slug: 'first-responders',
    label: 'First Responders',
    seoTitle: 'First Responder Fundraisers',
    metaDescription:
      'Support firefighters, paramedics, and first responders. Verified campaigns with zero platform fees.',
    heading: 'First Responder Fundraisers',
    intro:
      'Firefighters, paramedics, EMTs, search and rescue volunteers. They run toward danger, and when they get hurt or their families need help, they deserve a platform that treats their campaigns with respect. No hidden fees, no political removal of campaigns, and no AI chatbots when they need real support.',
    ogSubtitle: 'Support the people who run toward danger. Zero fees.',
    jsonLdDescription:
      'First responder fundraising campaigns on LastDonor.org. Verified, zero platform fees.',
    heroImageUrl: '/images/categories/first-responders-hero.webp',
    heroImageAlt: 'Group of firefighters in protective uniforms at their station',
    heroImageAttribution: 'myron Standret',
  },
  {
    slug: 'disaster',
    label: 'Disaster Relief',
    seoTitle: 'Disaster Relief Fundraisers',
    metaDescription:
      'Help disaster victims recover. Verified campaigns, fast payouts, zero hidden fees. No exploitation, no scams.',
    heading: 'Disaster Relief Fundraisers',
    intro:
      'Hurricanes, wildfires, floods, tornadoes. When disaster hits, scam campaigns appear on other platforms within hours. People exploit real suffering to pocket donations meant for victims. We verify every disaster campaign so donors know their money is going to actual victims, not opportunists. Funds move fast because people in shelters cannot wait.',
    ogSubtitle: 'Verified disaster relief. No scams, fast payouts.',
    jsonLdDescription:
      'Disaster relief fundraising campaigns on LastDonor.org. Verified victims, zero platform fees.',
    heroImageUrl: '/images/categories/disaster-hero.webp',
    heroImageAlt: 'Hurricane damage to a house with debris and scattered palm trees',
    heroImageAttribution: 'Asih Wahyuni',
  },
  {
    slug: 'essential-needs',
    label: 'Essential Needs',
    seoTitle: 'Essential Needs Fundraisers',
    metaDescription:
      'Help people cover rent, food, utilities, and basic needs. Verified campaigns with zero hidden fees.',
    heading: 'Essential Needs Fundraisers',
    intro:
      'Rent, groceries, utility bills, clothing for kids. Sometimes people need help with the basics, and there is no shame in that. These campaigns are for people who are one paycheck away from losing everything and just need a bridge to get through. We verify every campaign and there are zero platform fees, because taking a cut from someone who cannot afford groceries is not something we will do.',
    ogSubtitle: 'Help cover the basics. Verified, zero platform fees.',
    jsonLdDescription:
      'Essential needs fundraising campaigns on LastDonor.org. Verified, zero platform fees.',
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
