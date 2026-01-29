import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LoginPage from '../pages/Login';
import AdminLayout from '../layout/Layout';
import Dashboard from '../pages/Dashboard';
import Predicciones from '../pages/Predicciones';
import Clientes from '../pages/Clientes';
import Productos from '../pages/Productos';
import Categorias from '../pages/Categorias';
import CatalogoAdmin from '../pages/CatalogoAdmin';
import CatalogoPublico from '../pages/CatalogoPublico';
import Stock from '../pages/Stock';
import Finanzas from '../pages/Finanzas';
import Informes from '../pages/Informes';
import ConfiguracionAdmin from '../pages/ConfiguracionAdmin';
import Usuarios from '../pages/Usuarios';
import CRM from '../pages/CRM';
import Postventa from '../pages/Postventa';
import Aprobaciones from '../pages/Aprobaciones';
import Ventas from '../pages/Ventas';
import Compras from '../pages/Compras';
import Proveedores from '../pages/Proveedores';
import Multideposito from '../pages/Multideposito';
import Marketplace from '../pages/Marketplace';
import Arca from '../pages/Arca';
import { useAuth } from '../context/AuthContext';

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null; // or a loader
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/catalogo" element={<CatalogoPublico />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <Protected>
              <AdminLayout />
            </Protected>
          }
        >
          <Route index element={<Page><Dashboard /></Page>} />
          <Route path="dashboard" element={<Page><Dashboard /></Page>} />
          <Route path="clientes" element={<Page><Clientes /></Page>} />
          <Route path="productos" element={<Page><Productos /></Page>} />
          <Route path="ventas" element={<Page><Ventas /></Page>} />
          <Route path="compras" element={<Page><Compras /></Page>} />
          <Route path="proveedores" element={<Page><Proveedores /></Page>} />
          <Route path="multideposito" element={<Page><Multideposito /></Page>} />
          <Route path="categorias" element={<Page><Categorias /></Page>} />
          <Route path="catalogo" element={<Page><CatalogoAdmin /></Page>} />
          <Route path="stock" element={<Page><Stock /></Page>} />
          <Route path="finanzas" element={<Page><Finanzas /></Page>} />
          <Route path="informes" element={<Page><Informes /></Page>} />
          <Route path="usuarios" element={<Page><Usuarios /></Page>} />
          <Route path="configuracion" element={<Page><ConfiguracionAdmin /></Page>} />
          <Route path="predicciones" element={<Page><Predicciones /></Page>} />
          <Route path="crm" element={<Page><CRM /></Page>} />
          <Route path="postventa" element={<Page><Postventa /></Page>} />
          <Route path="aprobaciones" element={<Page><Aprobaciones /></Page>} />
          <Route path="marketplace" element={<Page><Marketplace /></Page>} />
          <Route path="arca" element={<Page><Arca /></Page>} />
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function Page({ children }: { children: JSX.Element }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

export default function AppRouter() {
  const useHashRouter =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || (window as any)?.desktopEnv?.isDesktop);
  return (
    useHashRouter ? (
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    ) : (
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    )
  );
}
