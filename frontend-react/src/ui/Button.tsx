import { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'outline';
  loading?: boolean;
};

export default function Button({ children, className, variant = 'primary', loading, disabled, ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 h-11 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-400/60';

  const variants = {
    primary:
      'text-white bg-primary-600 hover:bg-primary-500 shadow-lg hover:shadow-xl',
    ghost: 'text-slate-100 bg-white/5 hover:bg-white/10 border border-white/10',
    outline: 'text-slate-100 bg-transparent border border-accent-400/60 hover:bg-accent-400/10',
  } as const;

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={[
        base,
        variants[variant],
        disabled || loading ? 'opacity-60 cursor-not-allowed' : '',
        className || '',
      ].join(' ')}
      disabled={disabled || loading}
{...(rest as any)} // FIX


    >
      {children}
    </motion.button>
  );
}
