import { useEffect, useState, type FormEvent } from 'react';
import { Api, apiFetch } from '../lib/api';
import Alert from '../components/Alert';
import { useLicense } from '../context/LicenseContext';

export default function ConfiguracionAdmin() {
  const { status: licenseStatus, loading: licenseLoading, refresh: refreshLicense } = useLicense();
  const [dolarBlue, setDolarBlue] = useState<string>('');
  const [deudaUmbral, setDeudaUmbral] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deudaSaving, setDeudaSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deudaError, setDeudaError] = useState<string | null>(null);
  const [deudaSuccess, setDeudaSuccess] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const [depositos, setDepositos] = useState<any[]>([]);
  const [permisosSaving, setPermisosSaving] = useState(false);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<number | ''>('');
  const [usuarioDepositoIds, setUsuarioDepositoIds] = useState<number[]>([]);
  const [permisosSuccess, setPermisosSuccess] = useState<string | null>(null);
  const [permisosError, setPermisosError] = useState<string | null>(null);
  const [licenseCode, setLicenseCode] = useState('');
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<any | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudSuccess, setCloudSuccess] = useState<string | null>(null);
  const [cloudSnapshotError, setCloudSnapshotError] = useState<string | null>(null);
  const [cloudSnapshotSuccess, setCloudSnapshotSuccess] = useState<string | null>(null);
  const [cloudSnapshotLoading, setCloudSnapshotLoading] = useState(false);
  const [cloudQueueStatus, setCloudQueueStatus] = useState<any | null>(null);
  const [cloudQueueLoading, setCloudQueueLoading] = useState(false);
  const [cloudQueueError, setCloudQueueError] = useState<string | null>(null);
  const [cloudToken, setCloudToken] = useState('');
  const [cloudEndpoint, setCloudEndpoint] = useState('');
  const [cloudSaving, setCloudSaving] = useState(false);
  const [networkPolicy, setNetworkPolicy] = useState<'off' | 'private' | 'subnet'>('off');
  const [networkSubnet, setNetworkSubnet] = useState<string>('');
  const [networkSaving, setNetworkSaving] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkSuccess, setNetworkSuccess] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [factoryResetting, setFactoryResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      setDeudaError(null);
      setDeudaSuccess(null);
      try {
        const [data, deudaData] = await Promise.all([
          Api.getDolarBlue(),
          Api.getDebtThreshold().catch(() => null),
        ]);
        if (!mounted) return;
        const valor =
          data && typeof (data as any).valor === 'number'
            ? (data as any).valor
            : null;
        if (valor != null) {
          setDolarBlue(String(valor));
        }
        const deudaValor =
          deudaData && typeof (deudaData as any).valor === 'number'
            ? (deudaData as any).valor
            : null;
        if (deudaValor != null) {
          setDeudaUmbral(String(deudaValor));
        }
      } catch (e) {
        if (!mounted) return;
        setError(
          e instanceof Error
            ? e.message
            : 'No se pudo cargar el dólar blue'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setUsuariosLoading(true);
      setUsuariosError(null);
      try {
        const [usersRes, depsRes] = await Promise.all([
          apiFetch('/api/usuarios').catch(() => []),
          Api.depositos().catch(() => []),
        ]);
        setUsuarios(Array.isArray(usersRes) ? usersRes : []);
        setDepositos(Array.isArray(depsRes) ? depsRes : []);
      } catch (e) {
        setUsuariosError(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar usuarios o depЗsitos',
        );
      } finally {
        setUsuariosLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await Api.getNetworkPolicy();
        if (!active) return;
        const policy = data?.policy === 'private' || data?.policy === 'subnet' ? data.policy : 'off';
        setNetworkPolicy(policy);
        setNetworkSubnet(data?.subnet || '');
      } catch (err) {
        if (!active) return;
        setNetworkError(err instanceof Error ? err.message : 'No se pudo cargar la politica de red');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setCloudLoading(true);
      setCloudError(null);
      try {
        const data = await Api.cloudStatus();
        if (!active) return;
        setCloudStatus(data);
        setCloudEndpoint(data?.endpoint || '');
      } catch (err) {
        if (!active) return;
        setCloudError(err instanceof Error ? err.message : 'No se pudo cargar estado cloud');
      } finally {
        if (active) setCloudLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setBackupLoading(true);
      setBackupError(null);
      try {
        const data = await Api.listBackups();
        if (!active) return;
        setBackups(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        setBackupError(err instanceof Error ? err.message : 'No se pudieron cargar backups');
      } finally {
        if (active) setBackupLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function loadPermisos() {
      if (!selectedUsuarioId) {
        setUsuarioDepositoIds([]);
        return;
      }
      setPermisosError(null);
      setPermisosSuccess(null);
      try {
        const data = await apiFetch(`/api/usuarios/${selectedUsuarioId}/depositos`);
        const ids = Array.isArray(data)
          ? data
            .map((d: any) => Number(d.deposito_id ?? d.id))
            .filter((n) => Number.isInteger(n) && n > 0)
          : [];
        setUsuarioDepositoIds(ids);
      } catch (e) {
        setPermisosError(
          e instanceof Error
            ? e.message
            : 'No se pudieron cargar los depЗsitos del usuario',
        );
        setUsuarioDepositoIds([]);
      }
    }
    loadPermisos();
  }, [selectedUsuarioId]);

  async function onSubmitDolar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const valorNum = Number(dolarBlue);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setError('Ingresá un valor de dólar válido mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await Api.setDolarBlue(valorNum);
      setSuccess('Dólar blue actualizado correctamente');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo guardar el valor de dólar'
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitDeudaUmbral(e: FormEvent) {
    e.preventDefault();
    setDeudaError(null);
    setDeudaSuccess(null);
    const valorNum = Number(deudaUmbral);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      setDeudaError('Ingresa un umbral valido mayor a 0');
      return;
    }
    setDeudaSaving(true);
    try {
      await Api.setDebtThreshold(valorNum);
      setDeudaSuccess('Umbral de deuda actualizado correctamente');
    } catch (e) {
      setDeudaError(
        e instanceof Error ? e.message : 'No se pudo guardar el umbral de deuda'
      );
    } finally {
      setDeudaSaving(false);
    }
  }

  async function onResetPanel() {
    setResetError(null);
    setResetSuccess(null);
    const confirmed = window.confirm(
      '¿Seguro que querés borrar todos los datos del panel (clientes, productos, ventas, compras, etc.)? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      await Api.resetPanelData();
      setResetSuccess('Datos del panel limpiados correctamente.');
    } catch (e) {
      setResetError(
        e instanceof Error
          ? e.message
          : 'No se pudieron limpiar los datos del panel'
      );
    } finally {
      setResetting(false);
    }
  }

  function formatLicenseReason(reason: string | null) {
    if (!reason) return null;
    switch (reason) {
      case 'NO_LICENSE':
        return 'Sin licencia cargada';
      case 'EXPIRED':
        return 'Licencia vencida';
      case 'INSTALL_MISMATCH':
        return 'La licencia no corresponde a este equipo';
      case 'INVALID_SIGNATURE':
      case 'INVALID_CODE':
        return 'Licencia invalida';
      case 'NO_PUBLIC_KEY':
        return 'Servidor sin clave publica configurada';
      default:
        return 'Licencia no valida';
    }
  }

  async function onActivateLicense(e: FormEvent) {
    e.preventDefault();
    setLicenseError(null);
    setLicenseSuccess(null);
    const code = licenseCode.trim();
    if (!code) {
      setLicenseError('PegÃ¡ el cÃ³digo de licencia');
      return;
    }
    setLicenseSaving(true);
    try {
      await Api.activateLicense(code);
      setLicenseSuccess('Licencia activada correctamente');
      setLicenseCode('');
      await refreshLicense();
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : 'No se pudo activar la licencia');
    } finally {
      setLicenseSaving(false);
    }
  }

  async function onActivateCloud(e: FormEvent) {
    e.preventDefault();
    setCloudError(null);
    setCloudSuccess(null);
    const token = cloudToken.trim();
    if (!token) {
      setCloudError('Token requerido');
      return;
    }
    setCloudSaving(true);
    try {
      const res: any = await Api.cloudActivate({
        token,
        endpoint: cloudEndpoint.trim() || null,
      });
      setCloudStatus(res?.cloud || res);
      setCloudSuccess('Vinculacion cloud guardada');
      setCloudToken('');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'No se pudo vincular cloud');
    } finally {
      setCloudSaving(false);
    }
  }

  async function onSnapshotCloud() {
    setCloudSnapshotError(null);
    setCloudSnapshotSuccess(null);
    setCloudSnapshotLoading(true);
    try {
      await Api.cloudSnapshot();
      setCloudSnapshotSuccess('Snapshot encolado para sincronizar catalogo completo');
      await refreshCloudQueueStatus();
    } catch (err) {
      setCloudSnapshotError(err instanceof Error ? err.message : 'No se pudo generar snapshot');
    } finally {
      setCloudSnapshotLoading(false);
    }
  }

  async function refreshCloudQueueStatus() {
    setCloudQueueError(null);
    setCloudQueueLoading(true);
    try {
      const data = await Api.cloudQueueStatus();
      setCloudQueueStatus(data);
    } catch (err) {
      setCloudQueueError(err instanceof Error ? err.message : 'No se pudo obtener estado de sync');
    } finally {
      setCloudQueueLoading(false);
    }
  }

  function toggleUsuarioDeposito(depositoId: number) {
    setUsuarioDepositoIds((prev) =>
      prev.includes(depositoId)
        ? prev.filter((id) => id !== depositoId)
        : [...prev, depositoId],
    );
  }

  async function onGuardarPermisos(e: FormEvent) {
    e.preventDefault();
    if (!selectedUsuarioId) return;
    setPermisosError(null);
    setPermisosSuccess(null);
    setPermisosSaving(true);
    try {
      const payload = {
        depositos: usuarioDepositoIds.map((id) => ({ deposito_id: id })),
      };
      await apiFetch(`/api/usuarios/${selectedUsuarioId}/depositos`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setPermisosSuccess('Permisos de depЗsitos actualizados correctamente');
    } catch (e) {
      setPermisosError(
        e instanceof Error
          ? e.message
          : 'No se pudieron guardar los permisos de depЗsitos',
      );
    } finally {
      setPermisosSaving(false);
    }
  }

  async function onSaveNetwork(e: FormEvent) {
    e.preventDefault();
    setNetworkError(null);
    setNetworkSuccess(null);
    if (networkPolicy === 'subnet' && !networkSubnet.trim()) {
      setNetworkError('Ingresa una subred valida. Ej: 192.168.0.0/24');
      return;
    }
    setNetworkSaving(true);
    try {
      await Api.setNetworkPolicy({
        policy: networkPolicy,
        subnet: networkPolicy === 'subnet' ? networkSubnet.trim() : null,
      });
      setNetworkSuccess('Politica de red actualizada');
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'No se pudo guardar la politica de red');
    } finally {
      setNetworkSaving(false);
    }
  }

  async function onCreateBackup() {
    setBackupError(null);
    setBackupSuccess(null);
    setBackupLoading(true);
    try {
      await Api.createBackup();
      const data = await Api.listBackups();
      setBackups(Array.isArray(data) ? data : []);
      setBackupSuccess('Backup creado');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'No se pudo crear el backup');
    } finally {
      setBackupLoading(false);
    }
  }

  async function onRestoreBackup(filename: string) {
    const ok = window.confirm(`¿Restaurar el backup ${filename}? Esto reemplaza la base actual.`);
    if (!ok) return;
    setBackupError(null);
    setBackupSuccess(null);
    setBackupLoading(true);
    try {
      await Api.restoreBackup(filename);
      setBackupSuccess('Backup restaurado');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'No se pudo restaurar el backup');
    } finally {
      setBackupLoading(false);
    }
  }

  async function onFactoryReset() {
    setResetError(null);
    setResetSuccess(null);

    // Doble confirmación
    const c1 = window.confirm('ATENCION: Esto BORRARA TODA LA BASE DE DATOS. Se perderan todos los productos, ventas, clientes y usuarios. ¿Estas seguro?');
    if (!c1) return;

    const c2 = window.confirm('ULTIMA ADVERTENCIA: Esta accion NO se puede deshacer. ¿Borrar todo y reiniciar el sistema?');
    if (!c2) return;

    setFactoryResetting(true);
    try {
      await Api.factoryReset();
      alert('Sistema reiniciado. Se recargara la pagina.');
      window.location.href = '/';
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Fallo el reinicio de fabrica');
      setFactoryResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">
        Configuración
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Datos del negocio</div>
          <div className="space-y-3">
            <input
              className="input-modern w-full text-sm"
              placeholder="Nombre del comercio (opcional)"
            />
            <input
              className="input-modern w-full text-sm"
              placeholder="Email de contacto (opcional)"
            />
            <input
              className="input-modern w-full text-sm"
              placeholder="Moneda de facturación (ej: ARS)"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">
            Umbral de deuda (rojo, ARS)
          </div>
          <div className="space-y-3">
            {deudaError && <Alert kind="error" message={deudaError} />}
            {deudaSuccess && <Alert kind="info" message={deudaSuccess} />}
            <form onSubmit={onSubmitDeudaUmbral} className="space-y-2">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <input
                  className="input-modern flex-1 text-sm"
                  placeholder="Ej: 1000000"
                  type="number"
                  step="1"
                  min="1"
                  value={deudaUmbral}
                  onChange={(e) => setDeudaUmbral(e.target.value)}
                  disabled={loading || deudaSaving}
                />
                <button
                  type="submit"
                  className="h-11 rounded-lg bg-amber-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading || deudaSaving}
                >
                  {deudaSaving ? 'Guardando...' : 'Guardar umbral'}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Montos en ARS. Verde = 0, amarillo entre 1 y este umbral, rojo por encima.
              </p>
            </form>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Branding</div>
          <div className="space-y-3">
            <input
              className="input-modern w-full text-sm"
              placeholder="URL del logo (opcional)"
            />
            <input
              className="input-modern w-full text-sm"
              placeholder="Subtítulo o lema (opcional)"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Licencia de usuarios</div>
          <div className="space-y-3 text-sm text-slate-300">
            {licenseLoading && <div className="text-xs text-slate-400">Cargando licencia...</div>}
            {!licenseLoading && licenseStatus && (
              <div className="space-y-1 text-xs text-slate-400">
                <div>
                  Estado: {licenseStatus.licensed ? 'Activa' : 'No activa'}
                </div>
                {licenseStatus.install_id && (
                  <div className="flex items-center gap-2">
                    <span className="truncate">ID instalaciÃ³n: {licenseStatus.install_id}</span>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-200"
                      onClick={() => navigator.clipboard?.writeText(licenseStatus.install_id || '')}
                    >
                      Copiar
                    </button>
                  </div>
                )}
                {licenseStatus.licensed && (
                  <>
                    <div>Usuarios mÃ¡x: {licenseStatus.max_users ?? 'Sin lÃ­mite'}</div>
                    <div>Vence: {licenseStatus.expires_at ? new Date(licenseStatus.expires_at).toLocaleDateString() : 'Sin vencimiento'}</div>
                  </>
                )}
                {!licenseStatus.licensed && (
                  <div>Motivo: {formatLicenseReason(licenseStatus.reason) || 'No disponible'}</div>
                )}
              </div>
            )}

            {licenseError && <Alert kind="error" message={licenseError} />}
            {licenseSuccess && <Alert kind="info" message={licenseSuccess} />}

            <form onSubmit={onActivateLicense} className="space-y-2">
              <label className="block text-xs text-slate-400">
                CÃ³digo de licencia
              </label>
              <textarea
                className="input-modern w-full text-xs min-h-[120px]"
                placeholder="PegÃ¡ aquÃ­ el cÃ³digo de licencia (sin archivo)"
                value={licenseCode}
                onChange={(e) => setLicenseCode(e.target.value)}
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-indigo-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={licenseSaving}
              >
                {licenseSaving ? 'Activando...' : 'Activar licencia'}
              </button>
            </form>
          </div>
        </div>
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Vinculacion cloud</div>
          <div className="space-y-3 text-sm text-slate-300">
            {cloudLoading && <div className="text-xs text-slate-400">Cargando estado cloud...</div>}
            {!cloudLoading && cloudStatus && (
              <div className="space-y-1 text-xs text-slate-400">
                <div>Estado: {cloudStatus.linked ? 'Vinculado' : 'Sin vincular'}</div>
                {cloudStatus.device_id && (
                  <div className="flex items-center gap-2">
                    <span className="truncate">Device ID: {cloudStatus.device_id}</span>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-200"
                      onClick={() => navigator.clipboard?.writeText(cloudStatus.device_id || '')}
                    >
                      Copiar
                    </button>
                  </div>
                )}
                {cloudStatus.endpoint && (
                  <div className="truncate">Endpoint sync: {cloudStatus.endpoint}</div>
                )}
                {cloudStatus.slug && cloudStatus.endpoint && (
                  <div className="truncate">
                    URL publica:{' '}
                    {`${cloudStatus.endpoint.replace(/\/api\/?$/, '').replace(/\/$/, '')}/${cloudStatus.slug}`}
                  </div>
                )}
              </div>
            )}

            {cloudError && <Alert kind="error" message={cloudError} />}
            {cloudSuccess && <Alert kind="info" message={cloudSuccess} />}
            {cloudSnapshotError && <Alert kind="error" message={cloudSnapshotError} />}
            {cloudSnapshotSuccess && <Alert kind="info" message={cloudSnapshotSuccess} />}
            {cloudQueueError && <Alert kind="error" message={cloudQueueError} />}

            <form onSubmit={onActivateCloud} className="space-y-2">
              <label className="block text-xs text-slate-400">Token de vinculacion</label>
              <input
                className="input-modern w-full text-xs"
                placeholder="Pegue aqui el token cloud"
                value={cloudToken}
                onChange={(e) => setCloudToken(e.target.value)}
              />
              <label className="block text-xs text-slate-400">Endpoint cloud (opcional)</label>
              <input
                className="input-modern w-full text-xs"
                placeholder="https://mi-nube.com"
                value={cloudEndpoint}
                onChange={(e) => setCloudEndpoint(e.target.value)}
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-emerald-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={cloudSaving}
              >
                {cloudSaving ? 'Guardando...' : 'Vincular cloud'}
              </button>
            </form>
            <button
              type="button"
              className="h-9 rounded-lg bg-slate-700 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={cloudSnapshotLoading}
              onClick={onSnapshotCloud}
            >
              {cloudSnapshotLoading ? 'Encolando...' : 'Reenviar catalogo completo'}
            </button>
            <button
              type="button"
              className="h-9 rounded-lg bg-slate-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={cloudQueueLoading}
              onClick={refreshCloudQueueStatus}
            >
              {cloudQueueLoading ? 'Actualizando...' : 'Ver estado de sync'}
            </button>
            {cloudQueueStatus && (
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  Pendientes: {cloudQueueStatus.summary?.pending || 0} | Procesando:{' '}
                  {cloudQueueStatus.summary?.processing || 0} | Enviados:{' '}
                  {cloudQueueStatus.summary?.sent || 0} | Error:{' '}
                  {cloudQueueStatus.summary?.error || 0}
                </div>
                {cloudQueueStatus.last_sent_at && (
                  <div>Ultimo envio: {new Date(cloudQueueStatus.last_sent_at).toLocaleString()}</div>
                )}
                {Array.isArray(cloudQueueStatus.recent_errors) &&
                  cloudQueueStatus.recent_errors.length > 0 && (
                    <div>
                      Errores recientes:
                      <ul className="list-disc pl-4">
                        {cloudQueueStatus.recent_errors.map((e: any) => (
                          <li key={e.id}>{e.last_error || 'error'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Red permitida</div>
          <div className="space-y-3 text-sm">
            {networkError && <Alert kind="error" message={networkError} />}
            {networkSuccess && <Alert kind="info" message={networkSuccess} />}
            <form onSubmit={onSaveNetwork} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Politica</label>
                <select
                  className="input-modern w-full text-sm"
                  value={networkPolicy}
                  onChange={(e) => setNetworkPolicy(e.target.value as any)}
                  disabled={networkSaving}
                >
                  <option value="off">Sin restriccion</option>
                  <option value="private">Solo IPs privadas (LAN)</option>
                  <option value="subnet">Subred especifica</option>
                </select>
              </div>
              {networkPolicy === 'subnet' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subred</label>
                  <input
                    className="input-modern w-full text-sm"
                    placeholder="192.168.0.0/24"
                    value={networkSubnet}
                    onChange={(e) => setNetworkSubnet(e.target.value)}
                    disabled={networkSaving}
                  />
                </div>
              )}
              <button
                type="submit"
                className="h-9 rounded-lg bg-indigo-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={networkSaving}
              >
                {networkSaving ? 'Guardando...' : 'Guardar red'}
              </button>
            </form>
            <p className="text-xs text-slate-400">
              Si activas la restriccion, solo las PCs dentro de la red podran iniciar sesion.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Backups</div>
          <div className="space-y-3 text-sm">
            {backupError && <Alert kind="error" message={backupError} />}
            {backupSuccess && <Alert kind="info" message={backupSuccess} />}
            <button
              type="button"
              onClick={onCreateBackup}
              className="h-9 rounded-lg bg-emerald-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={backupLoading}
            >
              {backupLoading ? 'Creando...' : 'Crear backup'}
            </button>
            <div className="text-xs text-slate-400">Backups disponibles:</div>
            {backupLoading && !backups.length && (
              <div className="text-xs text-slate-500">Cargando backups...</div>
            )}
            {!backups.length && !backupLoading && (
              <div className="text-xs text-slate-500">Sin backups.</div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {backups.map((b: any) => (
                <div
                  key={b.filename}
                  className="flex items-center justify-between gap-2 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-lg px-2 py-2"
                >
                  <div className="flex flex-col">
                    <span className="truncate">{b.filename}</span>
                    <span className="text-[11px] text-slate-500">
                      {b.created_at ? new Date(b.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-amber-300 hover:text-amber-100"
                    onClick={() => onRestoreBackup(b.filename)}
                    disabled={backupLoading}
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">
            Dólar blue para precios
          </div>
          <div className="space-y-3">
            {error && <Alert kind="error" message={error} />}
            {success && <Alert kind="info" message={success} />}
            <form onSubmit={onSubmitDolar} className="space-y-2">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <input
                  className="input-modern flex-1 text-sm"
                  placeholder="Ej: 1500"
                  type="number"
                  step="0.01"
                  value={dolarBlue}
                  onChange={(e) => setDolarBlue(e.target.value)}
                  disabled={loading || saving}
                />
                <button
                  type="submit"
                  className="h-11 rounded-lg bg-emerald-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loading || saving}
                >
                  {saving ? 'Guardando...' : 'Guardar dólar'}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Este valor se usará como tipo de cambio base (dólar blue) para
                los cálculos de precios de todos los productos en USD.
              </p>
            </form>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">Herramientas avanzadas</div>
          <div className="space-y-3">
            {resetError && <Alert kind="error" message={resetError} />}
            {resetSuccess && <Alert kind="info" message={resetSuccess} />}
            <button
              type="button"
              onClick={onResetPanel}
              className="h-11 w-full rounded-lg bg-red-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={resetting}
            >
              {resetting ? 'Limpiando datos...' : 'Limpiar datos del panel'}
            </button>
            <p className="text-xs text-slate-400">
              Borra clientes, productos, ventas, compras, CRM, tickets y logs cargados desde el panel.
              No toca usuarios ni datos de login.
            </p>

            <div className="pt-4 border-t border-white/10 mt-4">
              <button
                type="button"
                onClick={onFactoryReset}
                className="h-11 w-full rounded-lg bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700/50 px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider"
                disabled={resetting || factoryResetting}
              >
                {factoryResetting ? 'RESTABLECIENDO...' : 'RESTABLECIMIENTO DE FABRICA'}
              </button>
              <p className="text-xs text-red-400/70 mt-2">
                PELIGRO: Borra TODO y deja el sistema como recien instalado.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="text-sm text-slate-300 mb-2">
            Permisos de depИsitos por usuario
          </div>
          <div className="space-y-3 text-sm">
            {usuariosError && <Alert kind="error" message={usuariosError} />}
            {permisosError && <Alert kind="error" message={permisosError} />}
            {permisosSuccess && <Alert kind="info" message={permisosSuccess} />}
            <form onSubmit={onGuardarPermisos} className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">
                    Usuario
                  </label>
                  <select
                    className="input-modern w-full text-sm"
                    value={selectedUsuarioId === '' ? '' : String(selectedUsuarioId)}
                    onChange={(e) =>
                      setSelectedUsuarioId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    disabled={usuariosLoading}
                  >
                    <option value="">
                      {usuariosLoading ? 'Cargando usuarios...' : 'Selecciona un usuario'}
                    </option>
                    {usuarios.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre || u.email} {u.rol ? `(${u.rol})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedUsuarioId && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">
                    Selecciona los depИsitos a los que el usuario puede acceder.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {depositos.map((d: any) => {
                      const checked = usuarioDepositoIds.includes(Number(d.id));
                      return (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 text-xs text-slate-200 bg-white/5 border border-white/10 rounded-lg px-2 py-1"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-500"
                            checked={checked}
                            onChange={() => toggleUsuarioDeposito(Number(d.id))}
                          />
                          <span>
                            {d.nombre}
                            {d.codigo ? ` (${d.codigo})` : ''}
                          </span>
                        </label>
                      );
                    })}
                    {!depositos.length && (
                      <div className="text-xs text-slate-500">
                        No hay depИsitos configurados.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-indigo-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={permisosSaving || !selectedUsuarioId}
                >
                  {permisosSaving ? 'Guardando...' : 'Guardar permisos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
