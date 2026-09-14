import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';

interface FeedbackBoxProps {
  explicacion: string;
  norma?: string;
  articulo?: string;
  correcta?: boolean;
}

function FeedbackBox({ explicacion, norma, articulo, correcta }: FeedbackBoxProps) {
  const Icon = correcta ? CheckCircle2 : XCircle;
  const color = correcta ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className={`mb-2 flex items-center gap-2 ${color}`}>
        <Icon size={16} />
        <span className="font-semibold">{correcta ? 'Correcto' : 'Incorrecto'}</span>
      </div>
      <p className="mb-3 text-slate-600">{explicacion}</p>
      <div className="rounded-lg bg-white p-3 text-xs text-slate-500">
        <div className="mb-1 flex items-center gap-1 text-slate-700">
          <BookOpen size={14} />
          <span className="font-medium">Norma:</span>
        </div>
        <p>{norma || 'No especificada'}</p>
        {articulo ? (
          <p className="mt-1">
            <span className="font-medium text-slate-700">Artículo:</span> {articulo}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default FeedbackBox;
export { FeedbackBox };
