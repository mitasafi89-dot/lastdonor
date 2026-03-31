/**
 * Blog Image Generator — Kling AI (kling-v2-1) integration for blog post images.
 *
 * Authentication: JWT (HS256) signed with KLING_SECRET_KEY, KLING_ACCESS_KEY as issuer.
 * API Region: Singapore (api-singapore.klingai.com).
 * Pipeline: Generate → Download from temporary URL → Upload to Supabase Storage → Return permanent URL.
 *
 * See docs/19-KLING-AI-IMAGE-GENERATION.md for the full reference.
 */

import jwt from 'jsonwebtoken';
import { supabase, BUCKET_NAME, getPublicUrl } from '../supabase-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlogImageRequest {
  type: 'hero' | 'section' | 'infographic';
  blogTitle: string;
  sectionHeading?: string;
  causeCategory: string;
  slug: string;
  sectionIndex?: number;
}

export interface BlogImageResult {
  url: string;
  altText: string;
  width: number;
  height: number;
  source: 'kling' | 'fallback' | 'default';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KLING_API_BASE = process.env.KLING_API_URL ?? 'https://api-singapore.klingai.com';
const KLING_MODEL = process.env.KLING_MODEL ?? 'kling-v2-1';

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 180_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;
const SUBMISSION_DELAY_MS = 1_000;

const IMAGE_DIMENSIONS: Record<string, { width: number; height: number; ratio: string }> = {
  hero: { width: 1200, height: 630, ratio: '16:9' },
  section: { width: 800, height: 450, ratio: '16:9' },
  infographic: { width: 800, height: 1067, ratio: '3:4' },
};

// ---------------------------------------------------------------------------
// Base style directive — prepended to every prompt (see Doc 19 §7)
// ---------------------------------------------------------------------------

const BASE_STYLE_DIRECTIVE = `STYLE: Modern flat vector illustration with clean geometric shapes and subtle gradients. Color palette restricted to deep teal (#0F766E), warm amber (#D97706), soft cream (#F8F6F2), and neutral grays. No photography. No photorealism. No realistic textures.

AESTHETIC: Abstract and conceptual. Represent themes through geometric shapes, icons, and symbols — never through realistic depictions. Clean lines, bold shapes, generous negative space. The image should look like a premium editorial illustration from a modern nonprofit annual report.

COMPOSITION: Centered focal point with supporting abstract elements. Balanced layout. Substantial negative space (at least 30% of canvas). No cluttered scenes. Suitable for web use as a blog header image.

MANDATORY EXCLUSIONS: No human faces. No realistic human bodies. No photographic elements. No 3D rendering. No dark/gloomy palettes. No text or typography in the image.`;

// ---------------------------------------------------------------------------
// Base negative prompt — always included (see Doc 19 §9)
// ---------------------------------------------------------------------------

const BASE_NEGATIVE_PROMPT = [
  'photograph, photorealistic, realistic, real photo, DSLR, camera, photography',
  '3D render, 3D, CGI, hyperrealistic, realistic textures, realistic lighting',
  'human face, human eyes, real person, portrait, headshot, skin tone, skin texture',
  'text, typography, words, letters, numbers, watermark, logo, signature, stamp',
  'blurry, low quality, distorted, deformed, ugly, amateur, pixelated',
  'dark, gloomy, depressing, horror, scary, disturbing, violent, gore, blood',
  'red color, purple color, bright green color, neon colors, rainbow',
  'cluttered, busy, noisy, complex background, multiple focal points',
].join(', ');

const CATEGORY_NEGATIVE_ADDITIONS: Record<string, string> = {
  medical: 'surgery, hospital bed, needles, blood draw, IV drip, medical equipment closeup',
  disaster: 'destruction, rubble, collapsed building, flood water, tornado, fire damage, wreckage',
  military: 'weapons, guns, combat, battlefield, war, explosion, camouflage',
  memorial: 'coffin, casket, graveyard, tombstone, crying, tears, mourning',
  emergency: 'accident, crash, injury, ambulance interior, stretcher, trauma',
  addiction: 'drugs, alcohol, needles, pills, bottles, substances, withdrawal',
  funeral: 'open casket, body, burial, cemetery, graves, mourners crying',
};

// ---------------------------------------------------------------------------
// Category-specific prompt templates (see Doc 19 §8)
// ---------------------------------------------------------------------------

const CATEGORY_PROMPTS: Record<string, { subject: string; elements: string; colorEmphasis: string; mood: string }> = {
  medical: {
    subject: 'Abstract representation of healing and medical support through geometric forms.',
    elements: 'Stylized medical cross made of teal geometric blocks. Heartbeat/pulse line rendered as a flowing amber ribbon. Circular shapes suggesting cellular healing. Gentle upward-arcing curves conveying recovery. A shield shape surrounding the medical cross suggesting care.',
    colorEmphasis: 'Deep teal (#0F766E) for the medical cross. Warm amber (#D97706) for the pulse line and highlights. Cream (#F8F6F2) background.',
    mood: 'Hopeful, warm, reassuring. Soft gradients suggesting dawn.',
  },
  disaster: {
    subject: 'Abstract representation of community resilience and rebuilding after hardship.',
    elements: 'Geometric house outline reconstructed from teal blocks. Amber rays breaking through from behind suggesting sunlight after storm. Interlocking geometric shapes forming a foundation. Ascending arrow motifs.',
    colorEmphasis: 'Deep teal (#0F766E) for building shapes. Warm amber (#D97706) for light rays. Gradient from darker gray at bottom to cream at top.',
    mood: 'Resilient, determined, forward-looking. Composition moves upward and outward.',
  },
  military: {
    subject: 'Abstract tribute to military service rendered as geometric symbols of duty and honor.',
    elements: 'Stylized shield or chevron shape in teal. Geometric star formation. Abstract dog tag shapes with clean lines. Strong vertical lines conveying structure.',
    colorEmphasis: 'Deep teal (#0F766E) dominant for structure. Amber (#D97706) warm accent. Neutral gray on cream (#F8F6F2) background.',
    mood: 'Dignified, proud, warm. Honorable and humane.',
  },
  veterans: {
    subject: 'Abstract representation of transition, new beginnings, and continued service.',
    elements: 'Geometric bridge connecting two stylized landscapes. Medal or star shapes in amber. Pathway as clean parallel lines leading forward. Circular shapes suggesting community.',
    colorEmphasis: 'Teal (#0F766E) bridge structure. Amber (#D97706) accents. Gradient from teal to amber suggesting transition.',
    mood: 'Hopeful, transitional, purposeful. Forward movement.',
  },
  memorial: {
    subject: 'Abstract representation of remembrance, legacy, and the warmth of memory.',
    elements: 'Stylized candle flame as amber geometric shape with glow. Concentric circles radiating outward. Abstract flower shapes in teal. A halo or ring of light.',
    colorEmphasis: 'Warm amber (#D97706) for flame center. Deep teal (#0F766E) for surrounding shapes. Warm cream to pale amber gradient.',
    mood: 'Peaceful, warm, dignified. Quiet and contemplative.',
  },
  'first-responders': {
    subject: 'Abstract tribute to emergency service duty through bold geometric symbols.',
    elements: 'Stylized badge or shield shape as central element. Geometric flame or medical cross rendered abstractly. Bold intersecting lines suggesting decisive action.',
    colorEmphasis: 'Deep teal (#0F766E) for badge. Amber (#D97706) for flame and urgency. Strong contrast on cream (#F8F6F2).',
    mood: 'Bold, courageous, warm. Strength paired with humanity.',
  },
  community: {
    subject: 'Abstract representation of togetherness, mutual support, and neighborhood strength.',
    elements: 'Interlocking circular or hexagonal shapes forming a connected network. Geometric forms fitting together like puzzle pieces. Abstract tree structure suggesting organic growth.',
    colorEmphasis: 'Alternating teal (#0F766E) and amber (#D97706) shapes. Softer tones where shapes overlap. Cream (#F8F6F2) background.',
    mood: 'Warm, inclusive, interconnected. Unity from diversity.',
  },
  'essential-needs': {
    subject: 'Abstract representation of stability, shelter, and fundamental necessities.',
    elements: 'Geometric house shape with strong roofline. Radiating lines from center suggesting warmth. Simple geometric forms for food (plate), water (droplet), warmth (flame). Protective arch.',
    colorEmphasis: 'Deep teal (#0F766E) for shelter structure. Amber (#D97706) for warmth rays. Stable lines in darker teal at base.',
    mood: 'Stable, secure, warm. Grounded and reassuring.',
  },
  education: {
    subject: 'Abstract representation of learning, growth, and intellectual empowerment.',
    elements: 'Geometric book shape as central form. Abstract ascending staircase pattern. Lightbulb as geometric teal and amber forms. Branching tree structure suggesting knowledge pathways.',
    colorEmphasis: 'Deep teal (#0F766E) for books. Amber (#D97706) for lightbulb and growth highlights. Cream (#F8F6F2) background.',
    mood: 'Aspirational, bright, forward-moving. Upward composition.',
  },
  animal: {
    subject: 'Abstract representation of animal care, compassion, and the human-animal bond.',
    elements: 'Stylized paw print as geometric teal shape. Abstract heart combining with paw motif. Simple geometric animal silhouettes using basic shapes. Sheltering arch suggesting protection.',
    colorEmphasis: 'Deep teal (#0F766E) for paw and animal shapes. Warm amber (#D97706) for heart and care accents. Cream (#F8F6F2) with warmth.',
    mood: 'Gentle, compassionate, warm. Softer edges reflecting tenderness.',
  },
  emergency: {
    subject: 'Abstract representation of rapid response, immediate relief, and crisis mobilization.',
    elements: 'Dynamic angular shapes suggesting speed. Geometric lightning bolt in amber. Concentric circles radiating from center. Arrow shapes pointing inward converging. Stabilizing horizontal base.',
    colorEmphasis: 'Amber (#D97706) dominant for urgency. Deep teal (#0F766E) for stabilizing structure. Higher contrast than other categories.',
    mood: 'Urgent but not chaotic. Purposeful energy.',
  },
  family: {
    subject: 'Abstract representation of family bonds, intergenerational support, and togetherness.',
    elements: 'Nested geometric shapes (larger protecting smaller). Abstract tree of life with branching limbs. Concentric circles for closeness. Hearth element anchoring composition.',
    colorEmphasis: 'Balanced teal (#0F766E) and amber (#D97706). Partnership and equality. Warm cream (#F8F6F2).',
    mood: 'Warm, nurturing, secure.',
  },
  faith: {
    subject: 'Abstract representation of spiritual community, devotion, and service through faith.',
    elements: 'Upward-reaching geometric forms. Abstract light rays from central point. Simple arch suggesting sacred architecture (non-denominational). Dove silhouette as two intersecting curves.',
    colorEmphasis: 'Deep teal (#0F766E) for community. Amber (#D97706) for spiritual warmth. Lighter background.',
    mood: 'Peaceful, reverent, communal. Non-denominational.',
  },
  environment: {
    subject: 'Abstract representation of environmental stewardship, nature, and sustainability.',
    elements: 'Geometric leaf shapes and abstract tree forms. Circular earth as concentric teal rings. Water droplet shapes. Abstract landscape with geometric hills. Infinity symbol in brand colors.',
    colorEmphasis: 'Deep teal (#0F766E) dominant. Amber (#D97706) for sun and energy accents. No green — teal carries the environmental message.',
    mood: 'Clean, hopeful, expansive. Open compositions.',
  },
  sports: {
    subject: 'Abstract representation of teamwork, athletic determination, and community through sport.',
    elements: 'Dynamic angular shapes suggesting movement. Abstract trophy or medal forms. Geometric field patterns. Overlapping shapes in motion. Ascending achievement forms.',
    colorEmphasis: 'Deep teal (#0F766E) for team elements. Amber (#D97706) for energy and achievement. High contrast.',
    mood: 'Energetic, determined, celebratory. Dynamic composition.',
  },
  creative: {
    subject: 'Abstract representation of artistic expression, creativity, and healing through art.',
    elements: 'Geometric paintbrush or pen shape. Abstract canvas or frame. Musical note shapes as geometric curves. Teal-to-amber gradient bands. Flowing curves contrasting with geometric forms.',
    colorEmphasis: 'Full teal-to-amber gradient spectrum. Most color variety within brand constraints.',
    mood: 'Expressive, inspiring, liberating. Less structured, more flowing.',
  },
  funeral: {
    subject: 'Abstract representation of celebrating a life lived, farewell, and community.',
    elements: 'Stylized memorial flame in amber. Gentle arch shapes suggesting passage. Abstract floral arrangement with geometric petals. Radiating light from warm center. Flowing ribbon shape.',
    colorEmphasis: 'Warm amber (#D97706) prominent. Deep teal (#0F766E) supporting. Pale amber/cream gradient background.',
    mood: 'Dignified, peaceful, warm. Celebration of life.',
  },
  addiction: {
    subject: 'Abstract representation of recovery, breaking free, and the journey toward healing.',
    elements: 'Broken chain links transforming into flowing shapes. Geometric phoenix or rising bird silhouette. Pathway widening forward. Sunrise as concentric amber arcs on horizon.',
    colorEmphasis: 'Transition gradient from teal (#0F766E) at bottom to amber (#D97706) at top. The color journey is the narrative.',
    mood: 'Triumphant, hopeful, transformative. Every element moves upward.',
  },
  elderly: {
    subject: 'Abstract representation of dignified aging, intergenerational connection, and elder care.',
    elements: 'Geometric tree with deep roots and wide canopy. Concentric rings (tree ring metaphor). Interlocking shapes of different sizes. Warm radiating elements suggesting wisdom.',
    colorEmphasis: 'Deep teal (#0F766E) for mature structure. Amber (#D97706) for warmth. Softer, warmer palette.',
    mood: 'Dignified, warm, respectful. Valued not vulnerable.',
  },
  justice: {
    subject: 'Abstract representation of fairness, advocacy, and equitable outcomes.',
    elements: 'Geometric balance scales in clean teal lines — perfectly level. Gavel as essential geometric form. Equal sign as prominent element. Shield suggesting protection. Strong vertical pillar.',
    colorEmphasis: 'Deep teal (#0F766E) for institutional structure. Amber (#D97706) for balance point. High contrast, clean lines.',
    mood: 'Resolute, principled, balanced. Symmetrical composition.',
  },
  housing: {
    subject: 'Abstract representation of stable housing, home ownership, and shelter security.',
    elements: 'Geometric key shape as central icon. Abstract house blueprint with architectural lines. Door frame suggesting welcome. Strong roofline angles. Foundation blocks stacked stably.',
    colorEmphasis: 'Deep teal (#0F766E) for structure. Amber (#D97706) for key and warmth from within. Light from doorway/window shapes.',
    mood: 'Secure, welcoming, stable.',
  },
  'mental-health': {
    subject: 'Abstract representation of mental wellness, inner peace, and emotional support.',
    elements: 'Geometric brain shape from flowing curves (stylized, not anatomical). Concentric calming ripples. Peaceful rolling geometric hills. Abstract sun suggesting clarity. Open space dominates.',
    colorEmphasis: 'Softer teal (#14B8A6) for calming elements. Amber (#D97706) as subtle warmth. More negative space than other categories.',
    mood: 'Calm, clear, supportive. Most spacious composition. Minimal elements.',
  },
  wishes: {
    subject: 'Abstract representation of dreams fulfilled, joy, and making the impossible possible.',
    elements: 'Geometric star burst radiating outward. Abstract gift box with amber ribbon. Sparkle shapes as diamond/rhombus forms. Ascending celebration shapes (confetti as geometric dots). Doorway opening to light.',
    colorEmphasis: 'Amber (#D97706) dominant — most amber-forward category. Deep teal (#0F766E) as grounding. Bright, high-energy palette.',
    mood: 'Joyful, magical, celebratory. Brightest and most energetic.',
  },
};

// ---------------------------------------------------------------------------
// JWT Authentication
// ---------------------------------------------------------------------------

function generateKlingToken(): string {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY must be set');
  }

  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: accessKey,
      exp: now + 1800,
      nbf: now - 5,
      iat: now,
    },
    secretKey,
    { algorithm: 'HS256', header: { alg: 'HS256', typ: 'JWT' } },
  );
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

export function buildImagePrompt(request: BlogImageRequest): string {
  const categoryPrompt = CATEGORY_PROMPTS[request.causeCategory];

  // Fall back to community-style prompt for unknown categories
  const template = categoryPrompt ?? CATEGORY_PROMPTS.community!;

  // Section images need visually distinct compositions per heading
  if (request.type === 'section' && request.sectionHeading) {
    const compositionVariants = [
      'Use a left-aligned focal point with supporting elements on the right.',
      'Use a radial composition with elements emanating from the center.',
      'Use a diagonal split composition with contrasting visual weight.',
      'Use a bottom-up perspective with ascending elements.',
      'Use a horizontal layered composition with distinct foreground and background.',
    ];
    const variantIdx = (request.sectionIndex ?? 0) % compositionVariants.length;

    return `${BASE_STYLE_DIRECTIVE}

SUBJECT: Create an illustration specifically about: "${request.sectionHeading}". Draw visual inspiration from this concept while maintaining the brand style.

VISUAL APPROACH: ${template.elements} Adapt these elements to visually represent the specific topic of "${request.sectionHeading}".

${compositionVariants[variantIdx]}

COLOR EMPHASIS: ${template.colorEmphasis}

MOOD: ${template.mood}

FORMAT: Blog section image, ${IMAGE_DIMENSIONS[request.type]!.ratio} aspect ratio. This image must look distinct from other images in the same article.`;
  }

  return `${BASE_STYLE_DIRECTIVE}

SUBJECT: ${template.subject}

VISUAL ELEMENTS: ${template.elements}

COLOR EMPHASIS: ${template.colorEmphasis}

MOOD: ${template.mood}

FORMAT: Blog ${request.type} image, ${IMAGE_DIMENSIONS[request.type]!.ratio} aspect ratio.`;
}

function buildNegativePrompt(causeCategory: string): string {
  const additions = CATEGORY_NEGATIVE_ADDITIONS[causeCategory];
  if (additions) {
    return `${BASE_NEGATIVE_PROMPT}, ${additions}`;
  }
  return BASE_NEGATIVE_PROMPT;
}

const SIMPLIFIED_RETRY_PROMPT =
  'Simple geometric abstract illustration in teal (#0F766E) and amber (#D97706) colors. ' +
  'Clean shapes on cream background. Modern editorial style. No text, no people.';

// ---------------------------------------------------------------------------
// Kling API Helpers
// ---------------------------------------------------------------------------

interface KlingApiResponse {
  code: number;
  message: string;
  data: {
    task_id: string;
    task_status?: string;
    task_status_msg?: string;
    task_result?: {
      images?: Array<{ url: string }>;
    };
  };
}

async function submitKlingTask(
  prompt: string,
  negativePrompt: string,
  aspectRatio: string,
  token: string,
): Promise<string | null> {
  const response = await fetch(`${KLING_API_BASE}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model_name: KLING_MODEL,
      prompt,
      negative_prompt: negativePrompt,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
  });

  const json = (await response.json()) as KlingApiResponse;
  if (json.code !== 0) {
    console.error(`Kling submit error: code=${json.code} message=${json.message}`);
    return null;
  }

  return json.data?.task_id ?? null;
}

async function pollKlingTask(taskId: string, token: string): Promise<string | null> {
  const maxAttempts = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const response = await fetch(`${KLING_API_BASE}/v1/images/generations/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = (await response.json()) as KlingApiResponse;
    if (json.code !== 0) {
      console.error(`Kling poll error: code=${json.code} message=${json.message}`);
      continue;
    }

    const status = json.data?.task_status;

    if (status === 'succeed') {
      const url = json.data?.task_result?.images?.[0]?.url;
      if (!url) {
        console.error('Kling task succeeded but no image URL returned');
        return null;
      }
      return url;
    }

    if (status === 'failed') {
      console.error(`Kling task failed: ${json.data?.task_status_msg ?? 'unknown reason'}`);
      return null;
    }

    // status is 'submitted' or 'processing' — keep polling
  }

  console.error(`Kling poll timeout after ${POLL_TIMEOUT_MS / 1000}s for task ${taskId}`);
  return null;
}

// ---------------------------------------------------------------------------
// Image Download & Upload
// ---------------------------------------------------------------------------

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to download Kling image: ${response.status}`);
    return null;
  }

  const contentType = response.headers.get('content-type') ?? 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

function getFileExtension(contentType: string): string {
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'png';
}

async function uploadToSupabase(
  buffer: Buffer,
  contentType: string,
  slug: string,
  imageType: string,
  causeCategory: string,
  sectionIndex?: number,
): Promise<string | null> {
  const ext = getFileExtension(contentType);
  const categorySlug = causeCategory.replace(/[^a-z0-9-]/gi, '');
  const storagePath = `blog/${slug}/${categorySlug}-${imageType}${sectionIndex !== undefined ? `-${sectionIndex}` : ''}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error(`Supabase upload error: ${error.message}`);
    return null;
  }

  return getPublicUrl(storagePath);
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export async function generateBlogImage(
  request: BlogImageRequest,
): Promise<BlogImageResult | null> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return null;
  }

  const dims = IMAGE_DIMENSIONS[request.type]!;
  const prompt = buildImagePrompt(request);
  const negativePrompt = buildNegativePrompt(request.causeCategory);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = generateKlingToken();
      const currentPrompt = attempt === 0 ? prompt : SIMPLIFIED_RETRY_PROMPT;

      if (attempt > 0) {
        console.warn(`Kling retry ${attempt}/${MAX_RETRIES} for ${request.slug}`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }

      // Submit task
      const taskId = await submitKlingTask(currentPrompt, negativePrompt, dims.ratio, token);
      if (!taskId) continue;

      // Brief delay before polling to let Kling begin processing
      await new Promise((r) => setTimeout(r, SUBMISSION_DELAY_MS));

      // Poll for result
      const temporaryUrl = await pollKlingTask(taskId, token);
      if (!temporaryUrl) continue;

      // Download immediately — Kling URLs are temporary
      const downloaded = await downloadImage(temporaryUrl);
      if (!downloaded) continue;

      // Upload to Supabase Storage for a permanent URL
      const permanentUrl = await uploadToSupabase(
        downloaded.buffer,
        downloaded.contentType,
        request.slug,
        request.type,
        request.causeCategory,
        request.sectionIndex,
      );
      if (!permanentUrl) continue;

      return {
        url: permanentUrl,
        altText: generateAltText(request),
        width: dims.width,
        height: dims.height,
        source: 'kling',
      };
    } catch (error) {
      console.error(`Kling attempt ${attempt} error:`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  return null;
}

/**
 * Get a fallback image URL based on the blog post's category.
 */
export function getFallbackImage(
  causeCategory: string,
  type: 'hero' | 'section' = 'hero',
): BlogImageResult {
  const dims = IMAGE_DIMENSIONS[type]!;

  const title = encodeURIComponent(causeCategory.replace(/-/g, ' '));
  const url = `/api/v1/og/page?title=${title}&subtitle=LastDonor.org`;

  return {
    url,
    altText: `${causeCategory.replace(/-/g, ' ')} illustration`,
    width: dims.width,
    height: dims.height,
    source: 'default',
  };
}

function generateAltText(request: BlogImageRequest): string {
  const category = request.causeCategory.replace(/-/g, ' ');
  if (request.type === 'hero') {
    return `Illustration for ${request.blogTitle}`;
  }
  if (request.type === 'section' && request.sectionHeading) {
    return `${category} illustration: ${request.sectionHeading}`;
  }
  return `${category} blog illustration`;
}
