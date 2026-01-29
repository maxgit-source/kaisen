import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Api } from '../lib/api';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import Button from '../ui/Button';
import Alert from '../components/Alert';
import Skeleton from '../ui/Skeleton';

type PeriodKey = '7d' | '30d' | '90d' | 'custom';
type AggKey = 'dia' | 'mes';

type Movimiento = {
  fecha: string;
  totalVentas: number;
  totalGastos: number;
  gananciaNeta: number;
};

type GananciaMensual = {
  mes: string;
  total_ventas: number;
  total_gastos: number;
  ganancia_neta: number;
};

type StockBajoRow = {
  producto_id: number;
  codigo: string;
  nombre: string;
  cantidad_disponible: number;
  stock_minimo: number;
};

type TopClienteRow = {
  cliente_id: number;
  nombre: string;
  apellido?: string | null;
  total_comprado: number;
};

type DeudaRow = {
  cliente_id: number;
  deuda_pendiente: number;
  deuda_0_30: number;
  deuda_31_60: number;
  deuda_61_90: number;
  deuda_mas_90: number;
  dias_promedio_atraso: number | null;
};

type TopProductoClienteRow = {
  producto_id: number;
  producto_nombre: string;
  total_cantidad: number;
  total_monto: number;
};

type CsvColumn<T> = { key: keyof T; label: string };

function toLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeRange(period: PeriodKey, desde: string, hasta: string) {
  const now = new Date();
  const todayStr = toLocalDateString(now);
  if (period === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { desde: toLocalDateString(d), hasta: todayStr };
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { desde: toLocalDateString(d), hasta: todayStr };
  }
  if (period === '90d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 89);
    return { desde: toLocalDateString(d), hasta: todayStr };
  }
  if (!desde || !hasta) return null;
  return { desde, hasta };
}

function csvEscape(value: any) {
  if (value == null) return '';
  const str = String(value);
  const safe = str.replace(/"/g, '""');
  if (safe.includes(',') || safe.includes('\n')) {
    return `"${safe}"`;
  }
  return safe;
}

function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvEscape((row as any)[c.key])).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = buildCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function Informes() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');
  const [agg, setAgg] = useState<AggKey>('dia');

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [movLoading, setMovLoading] = useState(true);
  const [movError, setMovError] = useState<string | null>(null);

  const [gananciasMensuales, setGananciasMensuales] = useState<GananciaMensual[]>([]);
  const [gananciasError, setGananciasError] = useState<string | null>(null);

  const [stockBajo, setStockBajo] = useState<StockBajoRow[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);

  const [topClientes, setTopClientes] = useState<TopClienteRow[]>([]);
  const [topError, setTopError] = useState<string | null>(null);

  const [deudas, setDeudas] = useState<DeudaRow[]>([]);
  const [deudasError, setDeudasError] = useState<string | null>(null);

  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
  const [topProductosCliente, setTopProductosCliente] = useState<TopProductoClienteRow[]>([]);
  const [topProdError, setTopProdError] = useState<string | null>(null);

  const range = useMemo(() => computeRange(period, customDesde, customHasta), [period, customDesde, customHasta]);

  useEffect(() => {
    if (!range) return;
    (async () => {
      setMovLoading(true);
      setMovError(null);
      try {
        const data = await Api.movimientosFinancieros({ ...range, agregado: agg });
        setMovimientos(
          (data || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
            totalGastos: Number(r.totalGastos || 0),
            gananciaNeta: Number(r.gananciaNeta || 0),
          }))
        );
      } catch (e: any) {
        setMovError(e?.message || 'No se pudieron cargar movimientos');
        setMovimientos([]);
      } finally {
        setMovLoading(false);
      }
    })();
  }, [range?.desde, range?.hasta, agg]);

  useEffect(() => {
    (async () => {
      setGananciasError(null);
      try {
        const rows = await Api.gananciasMensuales();
        setGananciasMensuales(
          (rows || []).map((r: any) => ({
            mes: r.mes,
            total_ventas: Number(r.total_ventas || 0),
            total_gastos: Number(r.total_gastos || 0),
            ganancia_neta: Number(r.ganancia_neta || 0),
          }))
        );
      } catch (e: any) {
        setGananciasError(e?.message || 'No se pudieron cargar ganancias mensuales');
        setGananciasMensuales([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setStockError(null);
      setTopError(null);
      setDeudasError(null);
      const results = await Promise.allSettled([
        Api.stockBajo(),
        Api.topClientes(20),
        Api.deudas(),
      ]);

      if (results[0].status === 'fulfilled') {
        setStockBajo(results[0].value || []);
      } else {
        setStockBajo([]);
        setStockError(results[0].reason?.message || 'No se pudo cargar stock bajo');
      }

      if (results[1].status === 'fulfilled') {
        setTopClientes(results[1].value || []);
      } else {
        setTopClientes([]);
        setTopError(results[1].reason?.message || 'No se pudo cargar top clientes');
      }

      if (results[2].status === 'fulfilled') {
        setDeudas(results[2].value || []);
      } else {
        setDeudas([]);
        setDeudasError(results[2].reason?.message || 'No se pudo cargar deudas');
      }
    })();
  }, []);

  useEffect(() => {
    if (!topClientes.length) return;
    if (selectedClienteId != null) return;
    setSelectedClienteId(topClientes[0].cliente_id);
  }, [topClientes, selectedClienteId]);

  useEffect(() => {
    if (!selectedClienteId) {
      setTopProductosCliente([]);
      return;
    }
    (async () => {
      setTopProdError(null);
      try {
        const rows = await Api.topProductosCliente(selectedClienteId, 10);
        setTopProductosCliente(rows || []);
      } catch (e: any) {
        setTopProdError(e?.message || 'No se pudieron cargar productos del cliente');
        setTopProductosCliente([]);
      }
    })();
  }, [selectedClienteId]);

  const totals = useMemo(() => {
    return movimientos.reduce(
      (acc, r) => {
        acc.ventas += r.totalVentas;
        acc.gastos += r.totalGastos;
        acc.neto += r.gananciaNeta;
        return acc;
      },
      { ventas: 0, gastos: 0, neto: 0 }
    );
  }, [movimientos]);

  const chartMovimientos = useMemo(
    () =>
      movimientos.map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
        gastos: r.totalGastos,
        neto: r.gananciaNeta,
      })),
    [movimientos]
  );

  const chartMensual = useMemo(
    () =>
      gananciasMensuales.map((r) => ({
        mes: new Date(r.mes).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        ventas: r.total_ventas,
        gastos: r.total_gastos,
        neto: r.ganancia_neta,
      })),
    [gananciasMensuales]
  );

  async function handleDownloadGananciasPdf() {
    if (!range) return;
    try {
      const blob = await Api.descargarInformeGanancias({ ...range, agregado: agg });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {}
  }

  function handleDownloadMovimientosCsv() {
    if (!range || !movimientos.length) return;
    downloadCsv(
      `movimientos-${range.desde}_a_${range.hasta}.csv`,
      movimientos,
      [
        { key: 'fecha', label: 'Fecha' },
        { key: 'totalVentas', label: 'Total ventas' },
        { key: 'totalGastos', label: 'Total gastos' },
        { key: 'gananciaNeta', label: 'Ganancia neta' },
      ]
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Informes</h2>
          <p className="text-sm text-slate-400">
            Reportes ejecutivos con filtros y descargas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            className="input-modern text-sm"
          >
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
            <option value="custom">Rango personalizado</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
                className="input-modern text-sm"
              />
              <input
                type="date"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
                className="input-modern text-sm"
              />
            </>
          )}
          <select
            value={agg}
            onChange={(e) => setAgg(e.target.value as AggKey)}
            className="input-modern text-sm"
          >
            <option value="dia">Dia</option>
            <option value="mes">Mes</option>
          </select>
          <Button variant="ghost" onClick={handleDownloadGananciasPdf} disabled={!range}>
            Descargar PDF ganancias
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadMovimientosCsv}
            disabled={!range || !movimientos.length}
          >
            Descargar CSV movimientos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4">
          <div className="text-xs text-slate-400">Total ventas</div>
          <div className="text-xl text-slate-100 font-semibold">${totals.ventas.toFixed(0)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4">
          <div className="text-xs text-slate-400">Total gastos</div>
          <div className="text-xl text-slate-100 font-semibold">${totals.gastos.toFixed(0)}</div>
        </div>
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4">
          <div className="text-xs text-slate-400">Ganancia neta</div>
          <div className="text-xl text-slate-100 font-semibold">${totals.neto.toFixed(0)}</div>
        </div>
      </div>

      <ChartCard title="Movimientos de ventas y gastos">
        {movError && <Alert kind="error" message={movError} />}
        <div className="h-64">
          {movLoading ? (
            <div className="h-full flex items-center justify-center">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !chartMovimientos.length ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Sin datos para el periodo seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMovimientos}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} />
                <Tooltip
                  wrapperStyle={{ outline: 'none' }}
                  contentStyle={{
                    background: 'rgba(2,6,23,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="ventas" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gastos" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="neto" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      <ChartCard title="Ganancias mensuales">
        {gananciasError && <Alert kind="error" message={gananciasError} />}
        <div className="h-64">
          {!chartMensual.length ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Sin datos disponibles
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMensual}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={{ stroke: '#334155' }} />
                <Tooltip
                  wrapperStyle={{ outline: 'none' }}
                  contentStyle={{
                    background: 'rgba(2,6,23,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="ventas" stroke="#22d3ee" fill="rgba(34,211,238,0.2)" />
                <Area type="monotone" dataKey="gastos" stroke="#f97316" fill="rgba(249,115,22,0.18)" />
                <Area type="monotone" dataKey="neto" stroke="#a855f7" fill="rgba(168,85,247,0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4">
          <DataTable
            headers={
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 px-2">Mes</th>
                  <th className="py-2 px-2 text-right">Ventas</th>
                  <th className="py-2 px-2 text-right">Gastos</th>
                  <th className="py-2 px-2 text-right">Ganancia neta</th>
                </tr>
              </thead>
            }
          >
            <tbody className="text-slate-200">
              {gananciasMensuales.map((r) => (
                <tr key={r.mes} className="border-t border-white/10">
                  <td className="py-2 px-2">
                    {new Date(r.mes).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-2 text-right">${r.total_ventas.toFixed(0)}</td>
                  <td className="py-2 px-2 text-right">${r.total_gastos.toFixed(0)}</td>
                  <td className="py-2 px-2 text-right">${r.ganancia_neta.toFixed(0)}</td>
                </tr>
              ))}
              {!gananciasMensuales.length && (
                <tr>
                  <td className="py-2 px-2 text-slate-400" colSpan={4}>
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Stock bajo">
          {stockError && <Alert kind="error" message={stockError} />}
          <DataTable
            headers={
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 px-2">Codigo</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Disponible</th>
                  <th className="py-2 px-2 text-right">Minimo</th>
                </tr>
              </thead>
            }
          >
            <tbody className="text-slate-200">
              {stockBajo.map((r) => (
                <tr key={r.producto_id} className="border-t border-white/10">
                  <td className="py-2 px-2">{r.codigo}</td>
                  <td className="py-2 px-2">{r.nombre}</td>
                  <td className="py-2 px-2 text-right">{r.cantidad_disponible}</td>
                  <td className="py-2 px-2 text-right">{r.stock_minimo}</td>
                </tr>
              ))}
              {!stockBajo.length && (
                <tr>
                  <td className="py-2 px-2 text-slate-400" colSpan={4}>
                    Sin alertas de stock
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </ChartCard>

        <ChartCard title="Top clientes y productos">
          {topError && <Alert kind="error" message={topError} />}
          <div className="mb-3">
            <select
              value={selectedClienteId ?? ''}
              onChange={(e) => setSelectedClienteId(Number(e.target.value) || null)}
              className="input-modern text-sm w-full"
            >
              {topClientes.map((c) => (
                <option key={c.cliente_id} value={c.cliente_id}>
                  {c.nombre} {c.apellido || ''} - ${Number(c.total_comprado || 0).toFixed(0)}
                </option>
              ))}
              {!topClientes.length && <option value="">Sin clientes</option>}
            </select>
          </div>
          {topProdError && <Alert kind="error" message={topProdError} />}
          <DataTable
            headers={
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Monto</th>
                </tr>
              </thead>
            }
          >
            <tbody className="text-slate-200">
              {topProductosCliente.map((r) => (
                <tr key={r.producto_id} className="border-t border-white/10">
                  <td className="py-2 px-2">{r.producto_nombre}</td>
                  <td className="py-2 px-2 text-right">{r.total_cantidad}</td>
                  <td className="py-2 px-2 text-right">${Number(r.total_monto || 0).toFixed(0)}</td>
                </tr>
              ))}
              {!topProductosCliente.length && (
                <tr>
                  <td className="py-2 px-2 text-slate-400" colSpan={3}>
                    Sin datos de productos
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </ChartCard>
      </div>

      <ChartCard title="Deudas por cliente">
        {deudasError && <Alert kind="error" message={deudasError} />}
        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">Cliente ID</th>
                <th className="py-2 px-2 text-right">Deuda</th>
                <th className="py-2 px-2 text-right">0-30</th>
                <th className="py-2 px-2 text-right">31-60</th>
                <th className="py-2 px-2 text-right">61-90</th>
                <th className="py-2 px-2 text-right">+90</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {deudas.slice(0, 20).map((r) => (
              <tr key={r.cliente_id} className="border-t border-white/10">
                <td className="py-2 px-2">{r.cliente_id}</td>
                <td className="py-2 px-2 text-right">${Number(r.deuda_pendiente || 0).toFixed(0)}</td>
                <td className="py-2 px-2 text-right">${Number(r.deuda_0_30 || 0).toFixed(0)}</td>
                <td className="py-2 px-2 text-right">${Number(r.deuda_31_60 || 0).toFixed(0)}</td>
                <td className="py-2 px-2 text-right">${Number(r.deuda_61_90 || 0).toFixed(0)}</td>
                <td className="py-2 px-2 text-right">${Number(r.deuda_mas_90 || 0).toFixed(0)}</td>
              </tr>
            ))}
            {!deudas.length && (
              <tr>
                <td className="py-2 px-2 text-slate-400" colSpan={6}>
                  Sin registros de deuda
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>
    </div>
  );
}
