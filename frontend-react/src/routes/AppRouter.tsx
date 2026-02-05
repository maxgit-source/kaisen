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
import SueldosVendedores from '../pages/SueldosVendedores';
import RemitoRedirect from '../pages/RemitoRedirect';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { FEATURE_LABELS, hasFeature, type FeatureKey } from '../lib/features';
import ModuloNoHabilitado from '../pages/ModuloNoHabilitado';

function Protected({ children }: { children: JSX.Element }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null; // or a loader
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function FeatureGate({ feature, children }: { feature: FeatureKey; children: JSX.Element }) {
  const { status, loading } = useLicense();
  if (loading) {
    return (
      <div className="text-sm text-slate-400">Cargando licencia...</div>
    );
  }
  if (!hasFeature(status, feature)) {
    return <ModuloNoHabilitado featureLabel={FEATURE_LABELS[feature]} />;
  }
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
          <Route path="multideposito" element={<Page><FeatureGate feature="multideposito"><Multideposito /></FeatureGate></Page>} />
          <Route path="categorias" element={<Page><Categorias /></Page>} />
          <Route path="catalogo" element={<Page><CatalogoAdmin /></Page>} />
          <Route path="stock" element={<Page><Stock /></Page>} />
          <Route path="finanzas" element={<Page><Finanzas /></Page>} />
          <Route path="informes" element={<Page><Informes /></Page>} />
          <Route path="usuarios" element={<Page><FeatureGate feature="usuarios"><Usuarios /></FeatureGate></Page>} />
          <Route path="sueldos-vendedores" element={<Page><FeatureGate feature="usuarios"><SueldosVendedores /></FeatureGate></Page>} />
          <Route path="configuracion" element={<Page><ConfiguracionAdmin /></Page>} />
          <Route path="predicciones" element={<Page><FeatureGate feature="ai"><Predicciones /></FeatureGate></Page>} />
          <Route path="crm" element={<Page><FeatureGate feature="crm"><CRM /></FeatureGate></Page>} />
          <Route path="postventa" element={<Page><FeatureGate feature="postventa"><Postventa /></FeatureGate></Page>} />
          <Route path="aprobaciones" element={<Page><FeatureGate feature="aprobaciones"><Aprobaciones /></FeatureGate></Page>} />
          <Route path="marketplace" element={<Page><FeatureGate feature="marketplace"><Marketplace /></FeatureGate></Page>} />
          <Route path="arca" element={<Page><FeatureGate feature="arca"><Arca /></FeatureGate></Page>} />
          <Route path="remitos/:id" element={<Page><RemitoRedirect /></Page>} />
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
