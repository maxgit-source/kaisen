import { ReactNode } from 'react';

export default function ChartCard({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="app-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-300">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
