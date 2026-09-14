import TemaLandingClient from '@/components/TemaLandingClient';
import { todasLasClaves } from '@/lib/topics';

export function generateStaticParams(): Array<{ tema: string }> {
  return todasLasClaves().map((clave) => ({ tema: clave }));
}

interface TemaPageProps {
  params: { tema: string };
}

export default function TemaPage() {
  return <TemaLandingClient />;
}
