/**
 * Authority Links Bank — curated external links to .gov/.edu/.org sources
 * per cause category. Provides the AI with REAL, verified URLs so it can
 * insert them instead of hallucinating or omitting external links.
 *
 * Every URL here is a known-stable page on a major institutional domain.
 * Last verified: 2025-12.
 */

export interface AuthorityLink {
  url: string;
  anchorText: string;
  context: string;
}

const GENERAL_LINKS: AuthorityLink[] = [
  {
    url: 'https://www.nptrust.org/philanthropic-resources/charitable-giving-statistics/',
    anchorText: 'charitable giving statistics',
    context: 'National Philanthropic Trust — annual charitable giving data',
  },
  {
    url: 'https://givingusa.org/',
    anchorText: 'Giving USA annual report',
    context: 'Giving USA — the definitive source for US charitable giving data',
  },
  {
    url: 'https://www.irs.gov/charities-non-profits',
    anchorText: 'IRS guidelines for charitable organizations',
    context: 'IRS — tax-deductible charitable giving rules',
  },
];

const CATEGORY_LINKS: Record<string, AuthorityLink[]> = {
  medical: [
    {
      url: 'https://www.nih.gov/health-information',
      anchorText: 'National Institutes of Health',
      context: 'NIH — health research and information',
    },
    {
      url: 'https://www.cdc.gov/health-topics.html',
      anchorText: 'Centers for Disease Control and Prevention',
      context: 'CDC — public health data and prevention',
    },
    {
      url: 'https://www.cms.gov/medical-bill-rights',
      anchorText: 'medical billing rights from CMS',
      context: 'CMS — patient billing rights and protections',
    },
  ],
  disaster: [
    {
      url: 'https://www.fema.gov/disaster/how-declared',
      anchorText: 'FEMA disaster declarations',
      context: 'FEMA — disaster relief and recovery programs',
    },
    {
      url: 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services.html',
      anchorText: 'Red Cross disaster relief',
      context: 'American Red Cross — emergency assistance services',
    },
    {
      url: 'https://www.ready.gov/',
      anchorText: 'Ready.gov emergency preparedness',
      context: 'Ready.gov — emergency preparedness resources',
    },
  ],
  military: [
    {
      url: 'https://www.va.gov/service-member-benefits/',
      anchorText: 'VA service member benefits',
      context: 'U.S. Department of Veterans Affairs — benefits overview',
    },
    {
      url: 'https://www.dav.org/',
      anchorText: 'Disabled American Veterans',
      context: 'DAV — benefits and support for disabled veterans',
    },
  ],
  veterans: [
    {
      url: 'https://www.va.gov/',
      anchorText: 'U.S. Department of Veterans Affairs',
      context: 'VA — comprehensive veteran services and benefits',
    },
    {
      url: 'https://www.dav.org/',
      anchorText: 'Disabled American Veterans',
      context: 'DAV — advocacy and support for veterans',
    },
  ],
  memorial: [
    {
      url: 'https://consumer.ftc.gov/articles/paying-funeral',
      anchorText: 'FTC guide to funeral costs',
      context: 'FTC — consumer rights and funeral cost transparency',
    },
    {
      url: 'https://nfda.org/news/statistics',
      anchorText: 'NFDA funeral industry statistics',
      context: 'National Funeral Directors Association — cost statistics',
    },
  ],
  funeral: [
    {
      url: 'https://consumer.ftc.gov/articles/paying-funeral',
      anchorText: 'FTC guide to funeral costs',
      context: 'FTC — funeral pricing rules and consumer rights',
    },
    {
      url: 'https://nfda.org/news/statistics',
      anchorText: 'NFDA funeral industry statistics',
      context: 'National Funeral Directors Association — cost data',
    },
  ],
  community: [
    {
      url: 'https://www.unitedway.org/',
      anchorText: 'United Way',
      context: 'United Way — community-based giving and impact data',
    },
    {
      url: 'https://www.pointsoflight.org/',
      anchorText: 'Points of Light',
      context: 'Points of Light — volunteer and civic engagement',
    },
  ],
  education: [
    {
      url: 'https://www.ed.gov/',
      anchorText: 'U.S. Department of Education',
      context: 'Federal education resources and data',
    },
    {
      url: 'https://studentaid.gov/',
      anchorText: 'Federal Student Aid',
      context: 'Official federal student financial aid information',
    },
  ],
  emergency: [
    {
      url: 'https://www.fema.gov/assistance/individual',
      anchorText: 'FEMA individual assistance',
      context: 'FEMA — individual and household emergency assistance',
    },
    {
      url: 'https://www.ready.gov/',
      anchorText: 'Ready.gov emergency preparedness',
      context: 'Ready.gov — emergency planning tools',
    },
  ],
  faith: [
    {
      url: 'https://www.charitynavigator.org/',
      anchorText: 'Charity Navigator ratings',
      context: 'Charity Navigator — nonprofit transparency and ratings',
    },
    {
      url: 'https://www.nptrust.org/philanthropic-resources/charitable-giving-statistics/',
      anchorText: 'charitable giving statistics',
      context: 'NPT — data on religious and faith-based giving',
    },
  ],
  'essential-needs': [
    {
      url: 'https://www.hud.gov/topics/rental_assistance',
      anchorText: 'HUD rental assistance programs',
      context: 'HUD — housing and essential needs support',
    },
    {
      url: 'https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program',
      anchorText: 'USDA SNAP program',
      context: 'USDA — food assistance program information',
    },
  ],
  animal: [
    {
      url: 'https://www.aspca.org/',
      anchorText: 'ASPCA',
      context: 'ASPCA — animal welfare resources and statistics',
    },
    {
      url: 'https://www.humanesociety.org/',
      anchorText: 'Humane Society of the United States',
      context: 'HSUS — animal protection advocacy and data',
    },
  ],
  'mental-health': [
    {
      url: 'https://www.nimh.nih.gov/',
      anchorText: 'National Institute of Mental Health',
      context: 'NIMH — mental health research and statistics',
    },
    {
      url: 'https://www.samhsa.gov/find-help/national-helpline',
      anchorText: 'SAMHSA National Helpline',
      context: 'SAMHSA — substance abuse and mental health services',
    },
  ],
  addiction: [
    {
      url: 'https://www.samhsa.gov/find-help/national-helpline',
      anchorText: 'SAMHSA National Helpline',
      context: 'SAMHSA — free treatment referral and information',
    },
    {
      url: 'https://nida.nih.gov/',
      anchorText: 'National Institute on Drug Abuse',
      context: 'NIDA — addiction science and treatment research',
    },
  ],
  elderly: [
    {
      url: 'https://acl.gov/',
      anchorText: 'Administration for Community Living',
      context: 'ACL — elder care programs and services',
    },
    {
      url: 'https://www.nia.nih.gov/',
      anchorText: 'National Institute on Aging',
      context: 'NIA — aging research and elder health resources',
    },
  ],
  housing: [
    {
      url: 'https://www.hud.gov/',
      anchorText: 'U.S. Department of Housing and Urban Development',
      context: 'HUD — housing assistance and affordability programs',
    },
    {
      url: 'https://www.habitat.org/',
      anchorText: 'Habitat for Humanity',
      context: 'Habitat — affordable housing and community building',
    },
  ],
  family: [
    {
      url: 'https://www.acf.hhs.gov/',
      anchorText: 'Administration for Children and Families',
      context: 'ACF — family support and child welfare programs',
    },
    {
      url: 'https://www.childwelfare.gov/',
      anchorText: 'Child Welfare Information Gateway',
      context: 'Child welfare — family support resources',
    },
  ],
  justice: [
    {
      url: 'https://www.justice.gov/',
      anchorText: 'U.S. Department of Justice',
      context: 'DOJ — justice and civil rights resources',
    },
    {
      url: 'https://www.lsc.gov/',
      anchorText: 'Legal Services Corporation',
      context: 'LSC — free legal aid for low-income Americans',
    },
  ],
  environment: [
    {
      url: 'https://www.epa.gov/',
      anchorText: 'U.S. Environmental Protection Agency',
      context: 'EPA — environmental protection and data',
    },
    {
      url: 'https://www.conservation.org/',
      anchorText: 'Conservation International',
      context: 'Conservation International — environmental preservation',
    },
  ],
};

/**
 * Get curated external authority links for a cause category.
 * Returns 2-3 category-specific links plus 1 general link.
 */
export function getAuthorityLinks(causeCategory: string): AuthorityLink[] {
  const categoryLinks = CATEGORY_LINKS[causeCategory] ?? [];
  // Pick up to 2 category-specific + 1 general
  const selected = categoryLinks.slice(0, 2);
  const general = GENERAL_LINKS.filter(
    (g) => !selected.some((s) => s.url === g.url),
  );
  if (general.length > 0) {
    selected.push(general[0]!);
  }
  return selected;
}
