import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-screen w-full grid" style={{ gridTemplateColumns: collapsed ? '80px 1fr' : '256px 1fr', gridTemplateRows: '64px 1fr' }}>
      <div className="row-span-2">
        <Sidebar collapsed={collapsed} />
      </div>
      <div>
        <Navbar onToggleSidebar={() => setCollapsed((c) => !c)} />
      </div>
      <main className="bg-neon text-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
