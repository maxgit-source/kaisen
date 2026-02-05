import { Bell, Search, Sun, Moon, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLicense } from '../context/LicenseContext';

function formatCountdown(expiresAt: string | null | undefined, nowMs: number) {
  if (!expiresAt) return null;
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp)) return null;
  const diff = Math.max(0, exp - nowMs);
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

export default function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const { status: licenseStatus } = useLicense();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!licenseStatus?.demo_active || !licenseStatus?.demo_expires_at) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, [licenseStatus?.demo_active, licenseStatus?.demo_expires_at]);

  const demoCountdown = useMemo(
    () => formatCountdown(licenseStatus?.demo_expires_at, nowMs),
    [licenseStatus?.demo_expires_at, nowMs]
  );

  const licenseLabel = (() => {
    if (!licenseStatus) return 'Licencia: -';
    if (!licenseStatus.licensed) return 'Licencia: Inactiva';
    if (licenseStatus.license_type === 'demo') {
      const total = licenseStatus.demo_days_total != null ? `${licenseStatus.demo_days_total} dias` : 'demo';
      const left = demoCountdown || (licenseStatus.demo_days_left != null ? `${licenseStatus.demo_days_left}d` : null);
      return left ? `Licencia: Demo (${total}) · Restan ${left}` : `Licencia: Demo (${total})`;
    }
    return 'Licencia: Activa';
  })();

  return (
    <header className="h-16 bg-white/5 backdrop-blur-md border-b border-white/10 px-6 flex items-center justify-between text-slate-200">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="rounded-md px-3 py-2 bg-white/10 hover:bg-white/15 text-slate-100 text-sm">Menú</button>
        <div className="text-sm text-slate-400">Inicio / Dashboard</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
          {licenseLabel}
        </div>
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




