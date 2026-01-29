import { ReactNode } from 'react';

export default function DataTable({ headers, children }: { headers: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        {headers}
        {children}
      </table>
    </div>
  );
}

