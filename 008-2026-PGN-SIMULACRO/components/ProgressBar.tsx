interface ProgressBarProps {
  actual: number;
  total: number;
  label?: string;
}

function ProgressBar({ actual, total, label }: ProgressBarProps) {

  const porcentaje = total > 0 ? Math.round((actual / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        {label && <span>{label}</span>}
        <span className="font-medium">{actual}/{total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-pgn-500 transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
export { ProgressBar };
