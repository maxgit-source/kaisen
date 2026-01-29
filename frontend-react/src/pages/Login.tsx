import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { BRAND } from '../config/branding';
import TextInput from '../components/TextInput';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import { login, setupAdmin, setupStatus } from '../lib/api';
import {
  clearApiBase,
  clearAppMode,
  clearTokens,
  getAppMode,
  getStoredApiBase,
  normalizeApiBase,
  setApiBase,
  setAppMode,
  type AppMode,
} from '../lib/storage';
import Button from '../ui/Button';
import AnimatedOrbs from '../ui/AnimatedOrbs';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: setAuthTokens } = useAuth();
  const [mode, setMode] = useState<AppMode | null>(() => getAppMode());
  const [apiBaseInput, setApiBaseInput] = useState(() => getStoredApiBase() || '');
  const [serverReady, setServerReady] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<{ ips: string[]; port: number; hostname?: string } | null>(null);
  const [serverInfoLoading, setServerInfoLoading] = useState(false);
  const [serverInfoError, setServerInfoError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const isDesktop =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || (window as any)?.desktopEnv?.isDesktop);
  const localBase = 'http://127.0.0.1:3000';

  const canSubmit = useMemo(() => {
    return (
      email.trim().length > 0 &&
      password.trim().length > 0 &&
      !loading &&
      serverReady &&
      setupRequired !== true
    );
  }, [email, password, loading, setupRequired, serverReady]);

  const canSetupSubmit = useMemo(() => {
    return (
      adminNombre.trim().length > 0 &&
      adminEmail.trim().length > 0 &&
      adminPassword.trim().length >= 6 &&
      adminPasswordConfirm.trim().length >= 6 &&
      adminPassword === adminPasswordConfirm &&
      !setupLoading
    );
  }, [
    adminNombre,
    adminEmail,
    adminPassword,
    adminPasswordConfirm,
    setupLoading,
  ]);
  const showAuthForms =
    mode === 'owner' || (mode === 'employee' && serverReady);
  const activeServer =
    mode === 'owner' ? localBase : getStoredApiBase() || apiBaseInput;

  async function checkServer(base: string) {
    const res = await fetch(`${base}/api/healthz`);
    if (!res.ok) throw new Error('No se pudo conectar al servidor');
    const data = await res.json().catch(() => ({}));
    if (data?.status !== 'ok') {
      throw new Error('Servidor no disponible');
    }
  }

  function resetOnboarding() {
    clearTokens();
    clearApiBase();
    clearAppMode();
    setMode(null);
    setApiBaseInput('');
    setServerReady(false);
    setServerLoading(false);
    setServerError(null);
    setSetupRequired(null);
    setSetupError(null);
    setSetupSuccess(false);
    setError(null);
  }

  function selectOwner() {
    setMode('owner');
    setAppMode('owner');
    if (isDesktop) {
      setApiBase(localBase);
    } else {
      clearApiBase();
    }
    setServerReady(true);
    setServerError(null);
  }

  function selectEmployee() {
    setMode('employee');
    setServerReady(false);
    setServerError(null);
  }

  async function onConnect(e: FormEvent) {
    e.preventDefault();
    if (serverLoading) return;
    setServerError(null);
    const normalized = normalizeApiBase(apiBaseInput);
    if (!normalized) {
      setServerError('IP o URL invalida');
      return;
    }
    setServerLoading(true);
    try {
      await checkServer(normalized);
      setApiBase(normalized);
      setAppMode('employee');
      setMode('employee');
      setApiBaseInput(normalized);
      setServerReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo conectar';
      setServerReady(false);
      setServerError(msg);
    } finally {
      setServerLoading(false);
    }
  }

  useEffect(() => {
    if (!mode) {
      setServerReady(false);
      setServerError(null);
      setSetupRequired(null);
      setServerInfo(null);
      setServerInfoError(null);
      return;
    }

    if (mode === 'owner') {
      if (isDesktop) {
        setApiBase(localBase);
      }
      setServerReady(true);
      setServerError(null);
      setServerInfoError(null);
      return;
    }

    const storedBase = getStoredApiBase();
    if (storedBase) {
      setApiBaseInput(storedBase);
    }
    if (!storedBase) {
      setServerReady(false);
      return;
    }

    let active = true;
    setServerLoading(true);
    setServerError(null);
    checkServer(storedBase)
      .then(() => {
        if (active) setServerReady(true);
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'No se pudo conectar';
        setServerReady(false);
        setServerError(msg);
      })
      .finally(() => {
        if (active) setServerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, isDesktop, localBase]);

  useEffect(() => {
    if (mode !== 'owner' || !serverReady) {
      setServerInfo(null);
      return;
    }
    let active = true;
    setServerInfoLoading(true);
    setServerInfoError(null);
    fetch(`${localBase}/api/server-info`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo obtener info del servidor');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setServerInfo({
          ips: Array.isArray(data?.ips) ? data.ips : [],
          port: Number(data?.port) || 3000,
          hostname: data?.hostname ? String(data.hostname) : undefined,
        });
      })
      .catch((err) => {
        if (!active) return;
        setServerInfoError(err instanceof Error ? err.message : 'No se pudo obtener info del servidor');
      })
      .finally(() => {
        if (active) setServerInfoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, serverReady, localBase]);

  useEffect(() => {
    if (mode !== 'owner' || !serverReady) {
      setSetupRequired(null);
      return;
    }
    let active = true;
    setupStatus()
      .then((data) => {
        if (active) setSetupRequired(Boolean(data?.requiresSetup));
      })
      .catch(() => {
        if (active) setSetupRequired(false);
      });
    return () => {
      active = false;
    };
  }, [mode, serverReady]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const { accessToken, refreshToken } = await login(email, password);
      setAuthTokens(accessToken, refreshToken, remember);
      navigate('/app', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  async function onSetupSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSetupSubmit) return;
    setSetupError(null);
    setSetupSuccess(false);
    setSetupLoading(true);
    try {
      await setupAdmin({
        nombre: adminNombre.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      });
      setSetupSuccess(true);
      setSetupRequired(false);
      setAdminNombre('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminPasswordConfirm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setSetupError(msg || 'No se pudo crear el admin');
    } finally {
      setSetupLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neon animate-hue relative overflow-hidden grid-sweep">
      <AnimatedOrbs />
      <div className="absolute inset-0 scanlines pointer-events-none" />
      <div className="w-full max-w-[480px] p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-8 sm:p-10 glow-ring"
        >
          <motion.div className="flex flex-col items-center gap-2" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Logo {...BRAND} />
            <div className="font-display text-xl text-slate-200 tracking-wide">Control total del inventario</div>
          </motion.div>

          {mode === null && (
            <div className="mt-8 space-y-3">
              <div className="text-xs text-slate-400">
                Selecciona el modo de inicio
              </div>
              <Button type="button" onClick={selectOwner}>
                Crear nuevo negocio (dueno)
              </Button>
              <Button type="button" variant="ghost" onClick={selectEmployee}>
                Conectar a negocio existente (empleado)
              </Button>
            </div>
          )}

          {mode === 'employee' && !serverReady && (
            <form onSubmit={onConnect} className="mt-6 space-y-4">
              <div className="text-sm font-semibold text-slate-200">
                Conectar a servidor
              </div>
              <p className="text-xs text-slate-400">
                Ingresa la IP o URL del servidor. Ej: 192.168.0.10:3000
              </p>
              {serverError && <Alert kind="error" message={serverError} />}

              <TextInput
                label="Servidor"
                type="text"
                name="server"
                value={apiBaseInput}
                onChange={(e) => setApiBaseInput(e.target.value)}
                placeholder="192.168.0.10:3000"
                required
              />

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={serverLoading}>
                  {serverLoading && <Spinner size={16} />}
                  <span className="ml-2">
                    {serverLoading ? 'Conectando...' : 'Conectar'}
                  </span>
                </Button>
                <Button type="button" variant="outline" onClick={resetOnboarding}>
                  Volver
                </Button>
              </div>
            </form>
          )}

          {mode && serverReady && (
            <div className="mt-6 space-y-1 text-xs text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {mode === 'owner' ? 'Modo dueno' : 'Modo empleado'}
                </span>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={resetOnboarding}
                >
                  Cambiar servidor
                </button>
              </div>
              {activeServer && (
                <div className="truncate">Servidor: {activeServer}</div>
              )}
              {mode === 'owner' && (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
                  <div className="text-xs text-slate-300">Servidor activo</div>
                  {serverInfoLoading && (
                    <div className="text-xs text-slate-500">Obteniendo IP local...</div>
                  )}
                  {serverInfoError && (
                    <div className="text-xs text-rose-300">{serverInfoError}</div>
                  )}
                  {serverInfo && (
                    <>
                      <div className="text-xs text-slate-400">
                        Puerto: {serverInfo.port}
                      </div>
                      {serverInfo.ips.length ? (
                        <div className="space-y-1">
                          <div className="text-xs text-slate-400">IP(s) locales:</div>
                          {serverInfo.ips.map((ip) => {
                            const address = `${ip}:${serverInfo.port}`;
                            return (
                              <div key={ip} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                                <span className="truncate">{address}</span>
                                <button
                                  type="button"
                                  className="text-xs text-slate-400 hover:text-slate-200"
                                  onClick={() => navigator.clipboard?.writeText(address)}
                                >
                                  Copiar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">No se detectaron IPs.</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {showAuthForms && (
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              {error && (
                <Alert kind="error" message={error || 'Usuario o contrase??a incorrectos.'} />
              )}

              {mode === 'owner' && setupSuccess && (
                <Alert kind="info" message="Admin creado. Ya podes iniciar sesion." />
              )}
              {mode === 'owner' && setupRequired && (
                <Alert kind="info" message="Configuracion inicial: crea el admin principal para habilitar el acceso." />
              )}

              <TextInput
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
              />

              <TextInput
                label="Contrase??a"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">Recordarme</span>
                </label>
                <a className="text-sm text-slate-500 hover:text-slate-700" href="#" onClick={(e)=>e.preventDefault()}>
                  ??Olvidaste la contrase??a?
                </a>
              </div>

              <Button type="submit" disabled={!canSubmit}>
                {loading && <Spinner size={16} />}
                <span className="ml-2">{loading ? 'Ingresando...' : 'Ingresar'}</span>
              </Button>

              <div className="pt-2 text-center text-xs text-slate-400">
                <p>Acceso restringido</p>
              </div>
            </form>
          )}

          {mode === 'owner' && setupRequired && (
            <form onSubmit={onSetupSubmit} className="mt-6 space-y-4">
              <div className="text-sm font-semibold text-slate-200">Primer acceso</div>
              <p className="text-xs text-slate-400">
                Crea el admin principal. Esta accion solo se puede hacer una vez.
              </p>
              {setupError && <Alert kind="error" message={setupError} />}

              <TextInput
                label="Nombre"
                type="text"
                name="admin-nombre"
                value={adminNombre}
                onChange={(e) => setAdminNombre(e.target.value)}
                required
              />
              <TextInput
                label="Email admin"
                type="email"
                name="admin-email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
              <TextInput
                label="Contrasena"
                type="password"
                name="admin-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
              <TextInput
                label="Confirmar contrasena"
                type="password"
                name="admin-password-confirm"
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                required
              />

              <Button type="submit" disabled={!canSetupSubmit}>
                {setupLoading && <Spinner size={16} />}
                <span className="ml-2">{setupLoading ? 'Creando...' : 'Crear admin'}</span>
              </Button>
            </form>
          )}

        </motion.div>
      </div>
    </div>
  );
}
