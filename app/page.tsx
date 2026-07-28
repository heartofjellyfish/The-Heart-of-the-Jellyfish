import type { Metadata } from 'next';
import { Medusa } from '@/components/Medusa';

export const metadata: Metadata = {
  title: '水母之心 / The Heart of the Jellyfish — Qi',
  description:
    'A debut album by Qi · 琦. Ten songs that read as a poem. Releasing 2026.12.20.',
};

export default function Home() {
  return (
    <>
      {/*
        Medusa names its families literally ('Cormorant Garamond', 'Jost'), so it
        needs the real Google Fonts stylesheet — the root layout only exposes
        Cormorant through next/font's hashed `--font-cormorant`. React hoists this
        link into <head>, and it unmounts with the route.
      */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500;1,600&family=Noto+Serif+SC:wght@300;400;600&family=Jost:wght@200;300;400&display=swap"
      />
      <Medusa />
    </>
  );
}
