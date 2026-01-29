import { Bell, Search, Sun, Moon, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();

  return (
    <header className="h-16 bg-white/5 backdrop-blur-md border-b border-white/10 px-6 flex items-center justify-between text-slate-200">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="rounded-md px-3 py-2 bg-white/10 hover:bg-white/15 text-slate-100 text-sm">Menú</button>
        <div className="text-sm text-slate-400">Inicio / Dashboard</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm text-slate-200">
          <Search size={16} />
          <input placeholder="Buscar..." className="bg-transparent outline-none w-48" />
        </div>
        <button className="p-2 rounded-md hover:bg-white/10 text-slate-200">
          <Bell size={18} />
        </button>
        <button onClick={toggle} className="p-2 rounded-md hover:bg-white/10 text-slate-200" title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={logout} className="p-2 rounded-md hover:bg-white/10 text-slate-200" title="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}




