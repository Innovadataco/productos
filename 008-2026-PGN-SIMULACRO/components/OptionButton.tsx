'use client';

interface OptionButtonProps {
  label: string;
  text: string;
  state?: 'default' | 'correct' | 'incorrect' | 'faded';
  onClick?: () => void;
  disabled?: boolean;
}

export default function OptionButton({ label, text, state = 'default', onClick, disabled }: OptionButtonProps) {
  const styles = {
    default: 'border-slate-200 bg-white text-slate-700 hover:border-pgn-400 hover:bg-pgn-50',
    correct: 'border-emerald-500 bg-emerald-50 text-emerald-800',
    incorrect: 'border-red-500 bg-red-50 text-red-800',
    faded: 'border-slate-100 bg-slate-50 text-slate-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${styles[state]} ${
        disabled ? 'cursor-default' : 'active:scale-[0.99]'
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">
        {label}
      </span>
      <span className="text-sm leading-relaxed">{text}</span>
    </button>
  );
}
