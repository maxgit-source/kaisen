import { NavLink } from 'react-router-dom';
import { BarChart3, Boxes, Settings, Users, Package, Home, Tag, Truck, FileText, Handshake } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRoleFromToken } from '../lib/auth';

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/productos', label: 'Productos', icon: Package, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/ventas', label: 'Ventas', icon: BarChart3, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/stock', label: 'Stock', icon: Boxes, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/compras', label: 'Compra de productos', icon: Package, roles: ['admin', 'gerente'] },
  { to: '/app/proveedores', label: 'Proveedores', icon: Truck, roles: ['admin', 'gerente'] },
  { to: '/app/categorias', label: 'Categorias', icon: Tag, roles: ['admin', 'gerente'] },
  { to: '/app/catalogo', label: 'Catalogo', icon: Tag, roles: ['admin', 'gerente'] },
  { to: '/app/multideposito', label: 'Multideposito', icon: Boxes, roles: ['admin', 'gerente'] },
  { to: '/app/predicciones', label: 'Predicciones', icon: BarChart3, roles: ['admin', 'gerente'] },
  { to: '/app/crm', label: 'CRM', icon: Users, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/marketplace', label: 'Marketplace', icon: Handshake, roles: ['admin', 'gerente'] },
  { to: '/app/arca', label: 'ARCA', icon: FileText, roles: ['admin', 'gerente'] },
  { to: '/app/postventa', label: 'Postventa', icon: Package, roles: ['admin', 'gerente', 'vendedor'] },
  { to: '/app/finanzas', label: 'Finanzas', icon: BarChart3, roles: ['admin', 'gerente'] },
  { to: '/app/informes', label: 'Informes', icon: FileText, roles: ['admin', 'gerente'] },
  { to: '/app/aprobaciones', label: 'Aprobaciones', icon: BarChart3, roles: ['admin', 'gerente'] },
  { to: '/app/usuarios', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { to: '/app/configuracion', label: 'Configuracion', icon: Settings, roles: ['admin'] },
];

export default function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const { accessToken } = useAuth();
  const role = useMemo(() => getRoleFromToken(accessToken), [accessToken]);
  const items = useMemo(() => {
    if (!role) return navItems;
    return navItems.filter((item) => !item.roles || item.roles.includes(role));
  }, [role]);

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="h-full bg-white/5 backdrop-blur-md text-slate-200 border-r border-white/10 flex flex-col"
      style={{ overflow: 'hidden' }}
    >
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">TC</div>
        {!collapsed && (
          <div>
            <div className="text-sm font-semibold">Tecnocel</div>
            <div className="text-[11px] text-slate-400">v1.0.0</div>
          </div>
        )}
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
              isActive ? 'bg-primary-500/15 text-white border border-primary-500/25' : 'hover:bg-white/10 text-slate-300 hover:text-white',
            ].join(' ')}
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 text-slate-400 text-sm">
        {!collapsed && <div>Acceso restringido</div>}
      </div>
    </motion.aside>
  );
}
