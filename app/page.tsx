import type { Metadata } from 'next';
import { Landing } from '@/components/Landing';

export const metadata: Metadata = {
  title: 'The Heart of the Jellyfish — Qi',
  description:
    'A debut album by Qi. Ten songs that read as a poem. Releasing 2026.12.20.',
};

export default function Home() {
  return (
    <>
      {/*
        The landing page names its families literally ('Cormorant Garamond',
        'Jost', 'Caveat'), so it needs the real Google Fonts stylesheet — the root
        layout only exposes Cormorant through next/font's hashed `--font-cormorant`.
        Caveat is the poem's hand. Noto Serif SC is gone with the Chinese copy.
        React hoists this link into <head>, and it unmounts with the route.
      */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=La+Belle+Aurore&family=Shadows+Into+Light+Two&family=Nothing+You+Could+Do&family=The+Girl+Next+Door&family=Sacramento&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500;1,600&family=Jost:wght@200;300;400&display=swap"
      />
      <Landing />
    </>
  );
}
