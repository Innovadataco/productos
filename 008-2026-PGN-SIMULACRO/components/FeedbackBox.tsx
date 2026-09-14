import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';

interface FeedbackBoxProps {
  explicacion: string;
  norma?: string;
  articulo?: string;
  correcta?: boolean;
}

function FeedbackBox({ explicacion, norma, articulo, correcta }: FeedbackBoxProps) {
  const Icon = correcta ? CheckCircle2 : XCircle;
  const wrapper = correcta
    ? 'border-success/30 bg-success/10'
    : 'border-danger/30 bg-danger/10';
  const accent = correcta ? 'text-success' : 'text-danger';

  return (
    <div className={`glass overflow-hidden border p-4 transition-all duration-300 animate-fade-up ${wrapper}`}>
      <div className={`mb-3 flex items-center gap-2 ${accent}`}>
        <Icon size={20} />
        <span className="text-body font-bold">{correcta ? 'Correcto' : 'Incorrecto'}</span>
      </div>
      <p className="mb-4 text-body text-ink-muted">{explicacion}</p>
      <div className="rounded-2xl bg-surface p-3 text-footnote text-ink-muted shadow-glass">
        <div className={`mb-1 flex items-center gap-2 ${accent}`}>
          <BookOpen size={14} />
          <span className="font-semibold">Norma:</span>
        </div>
        <p>{norma || 'No especificada'}</p>
        {articulo ? (
          <p className="mt-1">
            <span className="font-semibold text-ink">Artículo:</span> {articulo}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default FeedbackBox;
export { FeedbackBox };
