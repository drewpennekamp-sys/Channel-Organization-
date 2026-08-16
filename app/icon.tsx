import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 6,
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        CC
      </div>
    ),
    { ...size },
  );
}
