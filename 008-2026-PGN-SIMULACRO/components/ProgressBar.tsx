interface ProgressBarProps {
  actual: number;
  total: number;
  label?: string;
}

function ProgressBar({ actual, total, label }: ProgressBarProps) {
  const porcentaje = total > 0 ? Math.round((actual / total) * 100) : 0;

  return (
    <div className="w-full animate-fade-up">
      <div className="mb-1.5 flex items-center justify-between text-footnote text-ink-muted">
        {label && <span>{label}</span>}
        <span className="font-medium text-ink">
          {actual}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pgn-600 to-pgn-300 transition-all duration-500 ease-spring"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
export { ProgressBar };
