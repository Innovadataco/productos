import ResumenPageClient from '@/components/ResumenPageClient';
import { todasLasClaves } from '@/lib/topics';

export function generateStaticParams(): Array<{ tema: string }> {
  return todasLasClaves().map((clave) => ({ tema: clave }));
}

interface ResumenPageProps {
  params: { tema: string };
}

export default function ResumenPage() {
  return <ResumenPageClient />;
}
