interface ProgressBarProps {
  actual: number;
  total: number;
  label?: string;
}

function ProgressBar({ actual, total, label }: ProgressBarProps) {
  const porcentaje = total > 0 ? Math.round((actual / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-ios-footnote text-ios-label-secondary">
        {label && <span>{label}</span>}
        <span className="font-medium text-ios-label">
          {actual}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ios-gray-5">
        <div
          className="h-full rounded-full bg-ios-primary transition-all duration-300 ease-ios"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
export { ProgressBar };
