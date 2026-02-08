import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { getRoleFromToken } from '../lib/auth';
import { BRAND } from '../config/branding';
import { hasFeature, type FeatureKey } from '../lib/features';

type NavItem = { to: string; label: string; emoji: string; roles: string[]; feature?: FeatureKey };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', emoji: '📊', roles: ['admin', 'gerente', 'vendedor'] },
      { to: '/app/clientes', label: 'Clientes', emoji: '👥', roles: ['admin', 'gerente', 'vendedor'] },
      { to: '/app/productos', label: 'Productos', emoji: '📦', roles: ['admin', 'gerente', 'vendedor'] },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { to: '/app/ventas', label: 'Ventas', emoji: '💸', roles: ['admin', 'gerente', 'vendedor'] },
      { to: '/app/stock', label: 'Stock', emoji: '🧱', roles: ['admin', 'gerente', 'vendedor'] },
      { to: '/app/compras', label: 'Compra de productos', emoji: '🧾', roles: ['admin', 'gerente'] },
      { to: '/app/proveedores', label: 'Proveedores', emoji: '🚚', roles: ['admin', 'gerente'] },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { to: '/app/categorias', label: 'Categorias', emoji: '🏷️', roles: ['admin', 'gerente'] },
      { to: '/app/catalogo', label: 'Catalogo', emoji: '🛍️', roles: ['admin', 'gerente'] },
      { to: '/app/multideposito', label: 'Multideposito', emoji: '🏢', roles: ['admin', 'gerente'], feature: 'multideposito' },
      { to: '/app/predicciones', label: 'Predicciones', emoji: '🔮', roles: ['admin', 'gerente'], feature: 'ai' },
    ],
  },
  {
    title: 'Avanzado',
    items: [
      { to: '/app/crm', label: 'CRM', emoji: '🧭', roles: ['admin', 'gerente', 'vendedor'], feature: 'crm' },
      { to: '/app/marketplace', label: 'Marketplace', emoji: '🧩', roles: ['admin', 'gerente'], feature: 'marketplace' },
      { to: '/app/arca', label: 'ARCA', emoji: '🧾', roles: ['admin', 'gerente'], feature: 'arca' },
      { to: '/app/postventa', label: 'Postventa', emoji: '🛠️', roles: ['admin', 'gerente', 'vendedor'], feature: 'postventa' },
      { to: '/app/finanzas', label: 'Finanzas', emoji: '📈', roles: ['admin', 'gerente'] },
      { to: '/app/informes', label: 'Informes', emoji: '🧠', roles: ['admin', 'gerente'] },
      { to: '/app/aprobaciones', label: 'Aprobaciones', emoji: '✅', roles: ['admin', 'gerente'], feature: 'aprobaciones' },
      { to: '/app/usuarios', label: 'Usuarios', emoji: '🧑‍💻', roles: ['admin'], feature: 'usuarios' },
      { to: '/app/sueldos-vendedores', label: 'Sueldo a vendedores', emoji: '💼', roles: ['admin'], feature: 'usuarios' },
      { to: '/app/configuracion', label: 'Configuracion', emoji: '⚙️', roles: ['admin'] },
    ],
  },
];

export default function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const { accessToken } = useAuth();
  const { status } = useLicense();
  const role = useMemo(() => getRoleFromToken(accessToken), [accessToken]);
  const groups = useMemo(() => {
    const filter = (item: NavItem) =>
      (!item.roles || item.roles.includes(role || '')) && hasFeature(status, item.feature);
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter(filter) }))
      .filter((g) => g.items.length > 0);
  }, [role, status]);
  const initials = useMemo(() => {
    return BRAND.name
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, []);

  return (
    <motion.aside
      animate={{ width: collapsed ? 88 : 272 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="h-full bg-black/40 backdrop-blur-xl text-slate-200 border-r border-white/10 flex flex-col"
      style={{ overflow: 'hidden' }}
    >
      <div className="h-[72px] flex items-center gap-3 px-5 border-b border-white/10 relative">
        <div className="absolute inset-0 opacity-60 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10" />
        <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center font-semibold shadow-[0_12px_30px_rgba(139,92,246,0.35)]">
          <span className="font-logo text-lg">{initials || 'SA'}</span>
        </div>
        {!collapsed && (
          <div className="relative">
            <div className="text-sm font-semibold">{BRAND.name}</div>
            <div className="text-[11px] text-slate-400 font-data">v1.0.0</div>
          </div>
        )}
      </div>

      <nav className="px-3 py-4 space-y-4 flex-1 app-scrollbar overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title} className="space-y-2">
            {!collapsed && (
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500 px-2">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map(({ to, label, emoji }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => [
                    'relative group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40',
                    isActive
                      ? 'active bg-indigo-500/15 text-white shadow-[0_10px_30px_rgba(99,102,241,0.15)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/5',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-indigo-400 transition-opacity',
                      'opacity-0 group-hover:opacity-60',
                      'group-[.active]:opacity-100',
                    ].join(' ')}
                  />
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-lg transition-transform group-hover:scale-110">
                    {emoji}
                  </span>
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 text-slate-400 text-xs">
        {!collapsed && <div>Acceso restringido</div>}
      </div>
    </motion.aside>
  );
}
