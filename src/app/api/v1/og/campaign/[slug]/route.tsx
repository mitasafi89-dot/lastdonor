import { ImageResponse } from '@vercel/og';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { centsToDollars } from '@/lib/utils/currency';
import { getCampaignPhase, getPhaseLabel } from '@/lib/utils/phase';
import { loadOgFonts } from '@/lib/og-fonts';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ slug: string }>;
}

const PHASE_COLORS: Record<string, string> = {
  first_believers: '#0F766E',
  the_push: '#0F766E',
  closing_in: '#D97706',
  last_donor_zone: '#8B2332',
};

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  const [campaign] = await db
    .select({
      title: campaigns.title,
      heroImageUrl: campaigns.heroImageUrl,
      raisedAmount: campaigns.raisedAmount,
      goalAmount: campaigns.goalAmount,
      subjectName: campaigns.subjectName,
      donorCount: campaigns.donorCount,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.slug, slug),
        or(
          eq(campaigns.status, 'active'),
          eq(campaigns.status, 'last_donor_zone'),
          eq(campaigns.status, 'completed'),
        ),
      ),
    )
    .limit(1);

  if (!campaign) {
    return new Response('Campaign not found', { status: 404 });
  }

  const percent = campaign.goalAmount > 0
    ? Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
    : 0;
  const phase = getCampaignPhase(campaign.raisedAmount, campaign.goalAmount);
  const phaseColor = PHASE_COLORS[phase];
  const phaseLabel = getPhaseLabel(phase);
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          position: 'relative',
          fontFamily: 'DM Sans',
        }}
      >
        {/* Background image */}
        <img
          src={campaign.heroImageUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 48px',
            gap: '16px',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontSize: 42,
              fontFamily: 'DM Serif Display',
              color: '#FFFFFF',
              lineHeight: 1.2,
              maxWidth: '80%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {campaign.title}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              color: '#E2E8F0',
              fontSize: 20,
            }}
          >
            <span>{centsToDollars(campaign.raisedAmount)} raised</span>
            <span>·</span>
            <span>{campaign.donorCount} donors</span>
            <span>·</span>
            <span style={{ color: phaseColor }}>{phaseLabel}</span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                borderRadius: '6px',
                backgroundColor: phaseColor,
              }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#94A3B8',
              fontSize: 16,
            }}
          >
            <span>
              {centsToDollars(campaign.raisedAmount)} of {centsToDollars(campaign.goalAmount)}
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#14B8A6',
              }}
            >
              lastdonor.org
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    },
  );
}
