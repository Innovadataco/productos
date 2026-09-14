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
  const textColors = {
    default: 'text-ink',
    correct: 'text-success',
    incorrect: 'text-danger',
    faded: 'text-ink-subtle',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`option-card min-h-[52px] ${textColors[state]} ${
        disabled ? 'cursor-default opacity-60' : 'active:scale-[0.98]'
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current text-caption font-bold">
        {label}
      </span>
      <span className="text-body leading-relaxed">{text}</span>
    </button>
  );
}
