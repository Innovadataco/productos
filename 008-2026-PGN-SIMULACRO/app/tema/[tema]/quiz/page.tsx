import QuizPageClient from '@/components/QuizPageClient';
import { todasLasClaves } from '@/lib/topics';

export function generateStaticParams(): Array<{ tema: string }> {
  return todasLasClaves().map((clave) => ({ tema: clave }));
}

interface QuizPageProps {
  params: { tema: string };
}

export default function QuizPage({ params }: QuizPageProps) {
  return <QuizPageClient temaClave={params.tema} />;
}
