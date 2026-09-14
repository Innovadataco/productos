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
    ? 'border-ios-green/30 bg-ios-green-light'
    : 'border-ios-red/30 bg-ios-red-light';
  const accent = correcta ? 'text-ios-green' : 'text-ios-red';

  return (
    <div className={`ios-card overflow-hidden border p-4 transition-all duration-300 ${wrapper}`}>
      <div className={`mb-3 flex items-center gap-2 ${accent}`}>
        <Icon size={20} />
        <span className="text-ios-body font-semibold">{correcta ? 'Correcto' : 'Incorrecto'}</span>
      </div>
      <p className="mb-4 text-ios-body text-ios-label-secondary">{explicacion}</p>
      <div className="rounded-ios-lg bg-ios-surface p-3 text-ios-footnote text-ios-label-secondary shadow-ios">
        <div className={`mb-1 flex items-center gap-2 ${accent}`}>
          <BookOpen size={14} />
          <span className="font-semibold">Norma:</span>
        </div>
        <p>{norma || 'No especificada'}</p>
        {articulo ? (
          <p className="mt-1">
            <span className="font-semibold text-ios-label">Artículo:</span> {articulo}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default FeedbackBox;
export { FeedbackBox };
