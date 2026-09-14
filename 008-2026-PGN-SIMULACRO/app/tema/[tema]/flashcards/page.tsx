import FlashcardsPageClient from '@/components/FlashcardsPageClient';
import { todasLasClaves } from '@/lib/topics';

export function generateStaticParams(): Array<{ tema: string }> {
  return todasLasClaves().map((clave) => ({ tema: clave }));
}

interface FlashcardsPageProps {
  params: { tema: string };
}

export default function FlashcardsPage() {
  return <FlashcardsPageClient />;
}
