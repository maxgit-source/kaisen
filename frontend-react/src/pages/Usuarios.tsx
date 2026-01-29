import { FormEvent, useEffect, useMemo, useState } from 'react';
import Alert from '../components/Alert';
import TextInput from '../components/TextInput';
import Button from '../ui/Button';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getRoleFromToken } from '../lib/auth';

type Role = {
  id: number;
  nombre: string;
};

type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rol?: string | null;
  activo?: boolean;
};

type PerformanceRow = {
  id: number;
  ventas_count: number;
  total_ventas: number;
  margen: number;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeActive(value: unknown) {
  if (value === undefined || value === null) return true;
  return Boolean(value);
}

export default function Usuarios() {
  const { accessToken } = useAuth();
  const role = useMemo(() => getRoleFromToken(accessToken), [accessToken]);
  const isAdmin = role === 'admin';

  const [roles, setRoles] = useState<Role[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activo, setActivo] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const vendedorRoleId = useMemo(() => {
    const roleRow = roles.find((r) => r.nombre === 'vendedor');
    return roleRow?.id || null;
  }, [roles]);

  const perfById = useMemo(() => {
    const map = new Map<number, PerformanceRow>();
    for (const row of performance) {
      map.set(Number(row.id), {
        id: Number(row.id),
        ventas_count: toNumber(row.ventas_count),
        total_ventas: toNumber(row.total_ventas),
        margen: toNumber(row.margen),
      });
    }
    return map;
  }, [performance]);

  const avgMargin = useMemo(() => {
    const values = performance.map((p) => toNumber(p.margen)).filter((v) => v > 0);
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [performance]);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  };

  function labelForPerformance(margen: number) {
    if (avgMargin <= 0) {
      if (margen > 0) return 'Rinde bien';
      return 'Viene mal';
    }
    if (margen >= avgMargin * 1.2) return 'Rinde bien';
    if (margen >= avgMargin * 0.7) return 'Rinde poco';
    return 'Viene mal';
  }

  async function loadData() {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const qs = params.toString();
      const [rolesRes, usersRes, perfRes] = await Promise.all([
        apiFetch('/api/roles'),
        apiFetch('/api/usuarios'),
        apiFetch(`/api/usuarios/rendimiento${qs ? `?${qs}` : ''}`),
      ]);
      setRoles(Array.isArray(rolesRes) ? rolesRes : []);
      const onlyVendedores = Array.isArray(usersRes)
        ? usersRes.filter((u: Usuario) => u.rol === 'vendedor')
        : [];
      setUsuarios(onlyVendedores);
      setPerformance(Array.isArray(perfRes) ? perfRes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vendedorRoleId) {
      setError('No se pudo resolver el rol vendedor');
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        nombre: nombre.trim(),
        email: email.trim(),
        activo,
        rol_id: vendedorRoleId,
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      if (editingId) {
        await apiFetch(`/api/usuarios/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess('Vendedor actualizado');
      } else {
        if (!payload.password) {
          setError('La contraseña es obligatoria para crear un vendedor');
          setSaving(false);
          return;
        }
        await apiFetch('/api/usuarios', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Vendedor creado');
      }
      setEditingId(null);
      setNombre('');
      setEmail('');
      setPassword('');
      setActivo(true);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vendedor');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(usuario: Usuario) {
    setEditingId(usuario.id);
    setNombre(usuario.nombre || '');
    setEmail(usuario.email || '');
    setPassword('');
    setActivo(normalizeActive(usuario.activo));
    setSuccess(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setNombre('');
    setEmail('');
    setPassword('');
    setActivo(true);
    setError(null);
    setSuccess(null);
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Usuarios</h2>
        <Alert kind="error" message="No tienes permisos para administrar usuarios." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100">Usuarios</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            className="input-modern h-11 text-sm"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
          <input
            type="date"
            className="input-modern h-11 text-sm"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
          <Button type="button" onClick={loadData} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {error && <Alert kind="error" message={error} />}
      {success && <Alert kind="info" message={success} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-5">
          <div className="text-sm text-slate-300 mb-3">
            {editingId ? 'Editar vendedor' : 'Registrar vendedor'}
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <TextInput
              label="Nombre"
              type="text"
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <TextInput
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextInput
              label={editingId ? 'Nueva contrasena (opcional)' : 'Contrasena'}
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editingId}
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
              />
              Activo
            </label>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear vendedor'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-5">
          <div className="text-sm text-slate-300 mb-3">Vendedores</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-200">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="text-left py-2">Vendedor</th>
                  <th className="text-left py-2">Ventas</th>
                  <th className="text-left py-2">Total</th>
                  <th className="text-left py-2">Margen</th>
                  <th className="text-left py-2">Rendimiento</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-left py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {usuarios.map((u) => {
                  const perf = perfById.get(u.id);
                  const margen = perf ? toNumber(perf.margen) : 0;
                  const total = perf ? toNumber(perf.total_ventas) : 0;
                  const ventasCount = perf ? toNumber(perf.ventas_count) : 0;
                  const label = labelForPerformance(margen);
                  const activoUsuario = normalizeActive(u.activo);
                  return (
                    <tr key={u.id}>
                      <td className="py-2">
                        <div className="font-medium">{u.nombre || u.email}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-2">{ventasCount}</td>
                      <td className="py-2">{formatMoney(total)}</td>
                      <td className="py-2">{formatMoney(margen)}</td>
                      <td className="py-2">
                        <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs">
                          {label}
                        </span>
                      </td>
                      <td className="py-2">{activoUsuario ? 'Activo' : 'Inactivo'}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="text-xs text-indigo-300 hover:text-indigo-200"
                          onClick={() => startEdit(u)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!usuarios.length && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-400">
                      No hay vendedores registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
