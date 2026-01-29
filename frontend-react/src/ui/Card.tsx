import { HTMLAttributes } from 'react';
export default function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-700 shadow-2xl', className || ''].join(' ')}
      {...rest}
    />
  );
}
