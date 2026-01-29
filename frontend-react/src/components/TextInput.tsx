import { InputHTMLAttributes, forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

const TextInput = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const inputId = id || rest.name || label.replace(/\s+/g, '-').toLowerCase();
    const hasError = Boolean(error);
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
          {label}
        </label>
        <input
          id={inputId}
          ref={ref}
          className={[
            'w-full h-11 rounded-lg border bg-white/5 px-3 text-[15px] outline-none transition text-slate-100',
            'placeholder:text-slate-400',
            hasError
              ? 'border-red-500/40 focus:border-red-500 focus:ring-2 focus:ring-red-500/30'
              : 'border-white/10 focus:border-accent-400/60 focus:ring-2 focus:ring-accent-400/40',
            className,
          ].join(' ')}
          {...rest}
        />
        {hasError && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

export default TextInput;
