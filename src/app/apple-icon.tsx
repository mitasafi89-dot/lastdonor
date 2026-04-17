import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F766E',
          borderRadius: 36,
        }}
      >
        <span
          style={{
            fontSize: 100,
            fontWeight: 700,
            color: '#FFFFFF',
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
          }}
        >
          LD
        </span>
        <span
          style={{
            fontSize: 100,
            fontWeight: 700,
            color: '#D97706',
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
            marginLeft: -4,
          }}
        >
          .
        </span>
      </div>
    ),
    { ...size },
  );
}
