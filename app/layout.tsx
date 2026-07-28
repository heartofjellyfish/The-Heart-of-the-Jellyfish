import './globals.css';
import type { Metadata } from 'next';
import { Cormorant_Garamond } from 'next/font/google';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const DESCRIPTION =
  'A debut album by Qi · 琦. Ten songs that read as a poem. Releasing 2026.12.20. 水母之心 — 首张概念专辑。';

export const metadata: Metadata = {
  metadataBase: new URL('https://qi.land'),
  title: '水母之心 / The Heart of the Jellyfish — Qi',
  description: DESCRIPTION,
  openGraph: {
    type: 'music.album',
    url: 'https://qi.land',
    siteName: 'Qi · 琦',
    title: '水母之心 / The Heart of the Jellyfish — Qi',
    description: DESCRIPTION,
    images: [{ url: '/images/og-cover.jpg', width: 1200, height: 892, alt: 'The Heart of the Jellyfish — album cover' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '水母之心 / The Heart of the Jellyfish — Qi',
    description: DESCRIPTION,
    images: ['/images/og-cover.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cormorant.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
