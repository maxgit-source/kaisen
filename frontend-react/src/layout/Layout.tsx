import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AppAmbient from '../ui/AppAmbient';

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      className="app-root app-surface min-h-screen w-full grid relative overflow-hidden font-ui"
      style={{ gridTemplateColumns: collapsed ? '80px 1fr' : '256px 1fr', gridTemplateRows: '72px 1fr' }}
    >
      <AppAmbient />
      <div className="row-span-2 relative z-10">
        <Sidebar collapsed={collapsed} />
      </div>
      <div className="relative z-10">
        <Navbar onToggleSidebar={() => setCollapsed((c) => !c)} />
      </div>
      <main className="relative z-10 text-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
