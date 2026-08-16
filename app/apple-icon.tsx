import { ImageResponse } from 'next/og';

// iOS applies its own rounded-corner mask to home screen icons, so this is
// deliberately a plain filled square (no border-radius) — rounding it
// ourselves would double up with iOS's mask and look wrong.
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
          background: '#1e293b',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          fontWeight: 700,
          fontSize: 80,
        }}
      >
        CC
      </div>
    ),
    { ...size },
  );
}
