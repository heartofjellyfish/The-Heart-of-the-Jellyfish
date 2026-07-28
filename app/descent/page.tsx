import type { Metadata } from 'next';
import { Descent } from '@/components/Descent';

export const metadata: Metadata = {
  title: 'Descent — 水母之心 / The Heart of the Jellyfish',
  description:
    'The scroll-driven 3D descent: above water, past the jellyfish, into the abyss.',
};

export default function DescentPage() {
  return <Descent />;
}
