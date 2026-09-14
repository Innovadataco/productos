'use client';

interface OptionButtonProps {
  label: string;
  text: string;
  state?: 'default' | 'correct' | 'incorrect' | 'faded';
  onClick?: () => void;
  disabled?: boolean;
}

export default function OptionButton({
  label,
  text,
  state = 'default',
  onClick,
  disabled,
}: OptionButtonProps) {
  const styles = {
    default:
      'border-ios-separator bg-ios-surface text-ios-label hover:border-ios-primary hover:bg-ios-primary-light',
    correct: 'border-ios-green bg-ios-green-light text-ios-green',
    incorrect: 'border-ios-red bg-ios-red-light text-ios-red',
    faded: 'border-ios-separator-light bg-ios-gray-6 text-ios-label-tertiary',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`ios-card flex min-h-[52px] w-full items-start gap-4 border-2 p-4 text-left transition-all ${styles[state]} ${
        disabled ? 'cursor-default' : 'active:scale-[0.98]'
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-ios-subhead font-bold">
        {label}
      </span>
      <span className="text-ios-body leading-relaxed">{text}</span>
    </button>
  );
}
