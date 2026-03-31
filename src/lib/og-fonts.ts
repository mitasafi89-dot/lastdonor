import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 500;
  style: 'normal';
}

let displayFontData: Buffer | null = null;
let bodyFontData: Buffer | null = null;

/**
 * Load brand fonts for OG image generation (Satori).
 * Fonts are cached in memory after first load.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  if (!displayFontData) {
    displayFontData = await readFile(
      join(process.cwd(), 'public', 'fonts', 'DMSerifDisplay-Regular.ttf'),
    );
  }
  if (!bodyFontData) {
    bodyFontData = await readFile(
      join(process.cwd(), 'public', 'fonts', 'DMSans-Medium.ttf'),
    );
  }

  return [
    { name: 'DM Serif Display', data: displayFontData, weight: 400, style: 'normal' },
    { name: 'DM Sans', data: bodyFontData, weight: 500, style: 'normal' },
  ];
}
