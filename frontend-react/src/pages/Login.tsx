import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { BRAND } from '../config/branding';
import TextInput from '../components/TextInput';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import {
  login,
  setupAdmin,
  setupStatus,
  licenseInstallId,
  activateLicensePublic,
  restoreBackupSetup,
} from '../lib/api';
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
  const [serverDetailsOpen, setServerDetailsOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installId, setInstallId] = useState<string | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [licenseCode, setLicenseCode] = useState('');
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const reduceMotion = useReducedMotion();
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
  const canRestoreSubmit = useMemo(() => {
    return Boolean(restoreFile && !restoreLoading);
  }, [restoreFile, restoreLoading]);
  const showAuthForms =
    mode === 'owner' || (mode === 'employee' && serverReady);
  const activeServer =
    mode === 'owner' ? localBase : getStoredApiBase() || apiBaseInput;

  const inputClass =
    'h-12 rounded-[10px] bg-black/30 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-400/20 focus:bg-black/40';
  const labelClass = 'text-sm font-medium text-slate-200';
  const demoExpired = Boolean(error && error.toLowerCase().includes('demo vencido'));
  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0 : 0.45,
      delay: reduceMotion ? 0 : delay,
      ease: 'easeOut',
    },
  });

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
    setRestoreError(null);
    setRestoreSuccess(null);
    setRestoreFile(null);
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
      setServerDetailsOpen(false);
      return;
    }

    if (mode === 'owner') {
      if (isDesktop) {
        setApiBase(localBase);
      }
      setServerReady(true);
      setServerError(null);
      setServerInfoError(null);
      setServerDetailsOpen(true);
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
    if (mode === 'owner' && serverReady) {
      setServerDetailsOpen(true);
    }
    if (mode !== 'owner' || !serverReady) {
      setServerDetailsOpen(false);
    }
  }, [mode, serverReady]);

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
    setInstallError(null);
    setLoading(true);
    try {
      const { accessToken, refreshToken } = await login(email, password);
      setAuthTokens(accessToken, refreshToken, remember);
      navigate('/app', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg || 'Usuario o contrasena incorrectos');
    } finally {
      setLoading(false);
    }
  }

  async function onFetchInstallId() {
    if (installLoading) return;
    setInstallError(null);
    setInstallLoading(true);
    try {
      const data = await licenseInstallId();
      setInstallId(data?.install_id || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo obtener el ID';
      setInstallError(msg);
    } finally {
      setInstallLoading(false);
    }
  }

  async function onActivatePublic(e?: FormEvent) {
    e?.preventDefault();
    if (licenseSaving) return;
    const code = licenseCode.trim();
    if (!code) {
      setLicenseError('Pega el codigo de licencia');
      return;
    }
    setLicenseError(null);
    setLicenseSuccess(null);
    setLicenseSaving(true);
    try {
      await activateLicensePublic(code);
      setLicenseSuccess('Licencia activada. Ahora podes iniciar sesion.');
      setLicenseCode('');
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo activar la licencia';
      setLicenseError(msg);
    } finally {
      setLicenseSaving(false);
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

  async function onRestoreBackupSubmit(e: FormEvent) {
    e.preventDefault();
    if (!restoreFile || restoreLoading) return;
    setRestoreError(null);
    setRestoreSuccess(null);
    setRestoreLoading(true);
    try {
      await restoreBackupSetup(restoreFile);
      const data = await setupStatus().catch(() => ({ requiresSetup: false }));
      setSetupRequired(Boolean(data?.requiresSetup));
      setRestoreSuccess('Backup restaurado. Ya podes iniciar sesion.');
      setRestoreFile(null);
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : 'No se pudo restaurar el backup'
      );
    } finally {
      setRestoreLoading(false);
    }
  }

  useEffect(() => {
    if (demoExpired && !installId && !installLoading) {
      onFetchInstallId();
    }
  }, [demoExpired, installId, installLoading]);

  const primaryButtonClass =
    'relative group w-full h-12 px-5 rounded-[12px] overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-[0_12px_30px_rgba(99,102,241,0.35)] hover:shadow-[0_20px_50px_rgba(99,102,241,0.45)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-indigo-400/50';
  const secondaryButtonClass =
    'w-full h-12 px-5 rounded-[12px] bg-black/30 text-slate-200 border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-indigo-400/40';
  const modeButtonClass =
    'flex-1 rounded-xl px-3 py-3 text-sm font-medium text-slate-200 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40';

  return (
    <div className="login-root min-h-screen w-full flex items-center justify-center relative overflow-hidden px-4 sm:px-6">
      <AnimatedOrbs />
      <div className="w-full max-w-[480px]">
        <motion.div
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 rounded-[24px] bg-[#111118]/80 backdrop-blur-[20px] border border-[#6366f1]/20 shadow-[0_24px_60px_rgba(0,0,0,0.45),0_0_40px_rgba(99,102,241,0.2)] p-8 sm:p-12"
        >
          <motion.div {...fadeUp(0.2)}>
            <Logo {...BRAND} />
          </motion.div>

          {mode === null && (
            <motion.div {...fadeUp(0.3)} className="mt-8 space-y-4">
              <div className="text-[11px] uppercase tracking-[0.26em] text-slate-400">
                Selecciona el modo de inicio
              </div>
              <div className="flex flex-col sm:flex-row gap-2 rounded-xl bg-black/30 p-1">
                <button type="button" className={modeButtonClass} onClick={selectOwner}>
                  Crear nuevo negocio
                </button>
                <button type="button" className={modeButtonClass} onClick={selectEmployee}>
                  Conectar a negocio existente
                </button>
              </div>
            </motion.div>
          )}

          {mode === 'employee' && !serverReady && (
            <motion.form {...fadeUp(0.4)} onSubmit={onConnect} className="mt-6 space-y-4">
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
                className={inputClass}
                labelClassName={labelClass}
              />

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <Button type="submit" disabled={serverLoading} className={primaryButtonClass}>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {serverLoading && <Spinner size={16} />}
                    <span>{serverLoading ? 'Conectando...' : 'Conectar'}</span>
                  </span>
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-white/20 via-white/0 to-white/20" />
                </Button>
                <Button type="button" variant="ghost" onClick={resetOnboarding} className={secondaryButtonClass}>
                  Volver
                </Button>
              </div>
            </motion.form>
          )}

          {mode && serverReady && (
            <motion.div {...fadeUp(0.35)} className="mt-6 space-y-3 text-xs text-slate-400">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-[loginPulse_2s_ease-in-out_infinite] motion-reduce:animate-none" />
                  <span>{mode === 'owner' ? 'Modo dueno' : 'Modo empleado'}</span>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                  onClick={resetOnboarding}
                >
                  Cambiar servidor
                </button>
              </div>
              {activeServer && (
                <div className="truncate text-slate-400">
                  Servidor: <span className="text-slate-200">{activeServer}</span>
                </div>
              )}
              {mode === 'owner' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-slate-300 transition-colors hover:bg-black/30"
                    onClick={() => setServerDetailsOpen((prev) => !prev)}
                    aria-expanded={serverDetailsOpen}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="4" width="18" height="6" rx="2" />
                        <rect x="3" y="14" width="18" height="6" rx="2" />
                        <path d="M7 7h.01M7 17h.01" />
                      </svg>
                      <span>Servidor activo</span>
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform duration-300 ${serverDetailsOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  <AnimatePresence initial={false}>
                    {serverDetailsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
                        className="overflow-hidden rounded-xl border border-white/10 bg-black/30 p-4 space-y-2"
                      >
                        {serverInfoLoading && (
                          <div className="text-xs text-slate-500">Obteniendo IP local...</div>
                        )}
                        {serverInfoError && (
                          <div className="text-xs text-rose-300">{serverInfoError}</div>
                        )}
                        {serverInfo && (
                          <>
                            <div className="text-xs text-slate-400">
                              Puerto: <span className="text-slate-200">{serverInfo.port}</span>
                            </div>
                            {serverInfo.ips.length ? (
                              <div className="space-y-2">
                                <div className="text-xs text-slate-400">IP(s) locales:</div>
                                {serverInfo.ips.map((ip) => {
                                  const address = `${ip}:${serverInfo.port}`;
                                  return (
                                    <div key={ip} className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2">
                                      <span className="truncate font-ip text-[12px] text-slate-200 bg-indigo-500/10 px-2 py-1 rounded-md">
                                        {address}
                                      </span>
                                      <button
                                        type="button"
                                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-200 hover:bg-indigo-500/10 transition-colors"
                                        onClick={() => navigator.clipboard?.writeText(address)}
                                        title="Copiar"
                                      >
                                        <svg
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <rect x="9" y="9" width="13" height="13" rx="2" />
                                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {showAuthForms && (
            <motion.form {...fadeUp(0.4)} onSubmit={onSubmit} className="mt-8 space-y-5">
              {error && (
                <Alert kind="error" message={error || 'Usuario o contrasena incorrectos.'} />
              )}
              {licenseSuccess && (
                <Alert kind="info" message={licenseSuccess} />
              )}

              {mode === 'owner' && setupSuccess && (
                <Alert kind="info" message="Admin creado. Ya podes iniciar sesion." />
              )}
              {mode === 'owner' && setupRequired && (
                <Alert kind="info" message="Configuracion inicial: crea el admin principal para habilitar el acceso." />
              )}

              {demoExpired && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3 text-xs text-slate-300">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    Activacion de licencia
                  </div>
                  <p className="text-slate-400">
                    La demo vencio. Envia este ID al proveedor para generar la licencia.
                  </p>
                  {installError && (
                    <div className="text-rose-300">{installError}</div>
                  )}
                  {licenseError && (
                    <div className="text-rose-300">{licenseError}</div>
                  )}
                  {installId && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2">
                      <span className="truncate font-ip text-slate-200 bg-indigo-500/10 px-2 py-1 rounded-md">
                        {installId}
                      </span>
                      <button
                        type="button"
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-200 hover:bg-indigo-500/10 transition-colors"
                        onClick={() => navigator.clipboard?.writeText(installId)}
                        title="Copiar"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <Button type="button" variant="ghost" className={secondaryButtonClass} onClick={onFetchInstallId} disabled={installLoading}>
                    {installLoading && <Spinner size={16} />}
                    <span className="ml-2">
                      {installLoading ? 'Cargando...' : installId ? 'Actualizar ID' : 'Mostrar ID'}
                    </span>
                  </Button>

                  <div className="space-y-2">
                    <TextInput
                      label="Codigo de licencia"
                      type="text"
                      name="license-code"
                      value={licenseCode}
                      onChange={(e) => setLicenseCode(e.target.value)}
                      placeholder="Pega aqui el codigo de licencia"
                      className={inputClass}
                      labelClassName={labelClass}
                    />
                    <Button type="button" className={primaryButtonClass} disabled={licenseSaving} onClick={() => onActivatePublic()}>
                      {licenseSaving && <Spinner size={16} />}
                      <span className="ml-2">
                        {licenseSaving ? 'Activando...' : 'Activar licencia'}
                      </span>
                    </Button>
                  </div>
                </div>
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
                className={inputClass}
                labelClassName={labelClass}
              />

              <TextInput
                label="Contrasena"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                revealable
                className={inputClass}
                labelClassName={labelClass}
              />

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 select-none text-sm text-slate-300">
                  <span className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-white/15 bg-black/30 transition-colors peer-checked:bg-indigo-500 peer-checked:border-indigo-400 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400/40">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white scale-0 peer-checked:scale-100 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
                        aria-hidden="true"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </span>
                  <span>Recordarme</span>
                </label>
                <a className="text-sm text-slate-400 hover:text-white transition-colors" href="#" onClick={(e) => e.preventDefault()}>
                  Olvidaste la contrasena?
                </a>
              </div>

              <Button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading && <Spinner size={16} />}
                  <span>{loading ? 'Ingresando...' : 'Ingresar'}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 5 7 7-7 7" />
                  </svg>
                </span>
                <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-white/20 via-white/0 to-white/20" />
              </Button>

              <div className="pt-2 text-center text-xs text-slate-400">
                <p>Acceso restringido</p>
              </div>
            </motion.form>
          )}

          {mode === 'owner' && setupRequired && (
            <motion.form {...fadeUp(0.5)} onSubmit={onSetupSubmit} className="mt-6 space-y-4">
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
                className={inputClass}
                labelClassName={labelClass}
              />
              <TextInput
                label="Email admin"
                type="email"
                name="admin-email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className={inputClass}
                labelClassName={labelClass}
              />
              <TextInput
                label="Contrasena"
                type="password"
                name="admin-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                revealable
                className={inputClass}
                labelClassName={labelClass}
              />
              <TextInput
                label="Confirmar contrasena"
                type="password"
                name="admin-password-confirm"
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                required
                revealable
                className={inputClass}
                labelClassName={labelClass}
              />

              <Button type="submit" disabled={!canSetupSubmit} className={primaryButtonClass}>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {setupLoading && <Spinner size={16} />}
                  <span>{setupLoading ? 'Creando...' : 'Crear admin'}</span>
                </span>
                <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-white/20 via-white/0 to-white/20" />
              </Button>
            </motion.form>
          )}

          {mode === 'owner' && setupRequired && (
            <motion.form
              {...fadeUp(0.7)}
              onSubmit={onRestoreBackupSubmit}
              className="mt-6 space-y-3"
            >
              <div className="text-sm font-semibold text-slate-200">
                Restaurar desde backup
              </div>
              <p className="text-xs text-slate-400">
                Si tenes un archivo .sqlite/.db, podes recuperarlo y luego iniciar sesion.
              </p>
              {restoreError && <Alert kind="error" message={restoreError} />}
              {restoreSuccess && <Alert kind="info" message={restoreSuccess} />}
              <input
                type="file"
                accept=".sqlite,.db"
                className={inputClass}
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                disabled={restoreLoading}
              />
              <Button
                type="submit"
                disabled={!canRestoreSubmit}
                className={primaryButtonClass}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {restoreLoading && <Spinner size={16} />}
                  <span>{restoreLoading ? 'Restaurando...' : 'Restaurar backup'}</span>
                </span>
                <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-r from-white/20 via-white/0 to-white/20" />
              </Button>
            </motion.form>
          )}

        </motion.div>
      </div>
    </div>
  );
}
