import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Api } from '../lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
} from 'recharts';
import Button from '../ui/Button';

type PeriodKey = '24h' | '7d' | '30d' | 'custom';
type TabKey =
  | 'costos'
  | 'bruta'
  | 'neta'
  | 'producto'
  | 'categorias'
  | 'clientes'
  | 'cobranzas'
  | 'pagos'
  | 'cashflow'
  | 'presupuestos';

type SerieGananciaNeta = {
  fecha: string;
  totalVentas: number;
  totalCostoProductos: number;
  totalGastos: number;
  totalInversiones: number;
  gananciaBruta: number;
  gananciaNeta: number;
};

type SerieGananciaBruta = {
  fecha: string;
  totalVentas: number;
  totalCostoProductos: number;
  gananciaBruta: number;
};

type DetalleGananciaPorProducto = {
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
};

type DetalleCostosProducto = {
  productoId: number;
  productoCodigo: string;
  productoNombre: string;
  moneda: string;
  cantidad: number;
  totalCostos: number;
};

type DetalleRentabilidadCategoria = {
  categoriaId: number | null;
  categoriaNombre: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
};

type DetalleRentabilidadCliente = {
  clienteId: number;
  clienteNombre: string;
  clienteApellido: string;
  unidadesVendidas: number;
  ingresos: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentaje: number | null;
  deuda: number;
};

type DeudaClienteResumen = {
  clienteId: number;
  clienteNombre: string;
  clienteApellido: string;
  deudaTotal: number;
  deuda0_30: number;
  deuda31_60: number;
  deuda61_90: number;
  deudaMas90: number;
  diasPromedioAtraso: number | null;
};

type VentaPendiente = {
  ventaId: number;
  fecha: string;
  neto: number;
  totalPagado: number;
  saldo: number;
  dias: number;
};

type DeudaProveedorResumen = {
  proveedorId: number;
  proveedorNombre: string;
  deudaTotal: number;
  deuda0_30: number;
  deuda31_60: number;
  deuda61_90: number;
  deudaMas90: number;
  diasPromedioAtraso: number | null;
};

type PuntoCashflow = {
  fecha: string;
  entradas: number;
  salidas: number;
  saldoAcumulado: number;
};

type PresupuestoRow = {
  id?: number;
  anio: number;
  mes: number;
  tipo: string;
  categoria: string;
  monto: number;
};

type PresupuestoVsRealRow = {
  tipo: string;
  categoria: string;
  presupuesto: number;
  real: number;
  diferencia: number;
};

type PresupuestoTotales = {
  presupuestoVentas: number;
  realVentas: number;
  presupuestoGastos: number;
  realGastos: number;
};

type PresupuestoCategorias = {
  ventas: string[];
  gastos: string[];
};

type BrutaResumen = {
  totalVentas: number;
  totalCostoProductos: number;
  gananciaBruta: number;
  totalDescuentos: number;
  totalImpuestos: number;
};

type SimuladorResultado = {
  periodoDias: number;
  actual: {
    totalVentas: number;
    totalCosto: number;
    totalGastos: number;
    gananciaBruta: number;
    gananciaNeta: number;
  };
  simulado: {
    totalVentas: number;
    totalCosto: number;
    totalGastos: number;
    gananciaBruta: number;
    gananciaNeta: number;
  };
};

function toLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeRange(period: PeriodKey, desde: string, hasta: string): { desde: string; hasta: string } | null {
  const now = new Date();
  const todayStr = toLocalDateString(now);

  if (period === '24h') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { desde: toLocalDateString(d), hasta: todayStr };
  }
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
  if (!desde || !hasta) return null;
  return { desde, hasta };
}

const PIE_COLORS = ['#22c55e', '#0ea5e9', '#a855f7', '#f97316', '#eab308', '#14b8a6', '#ef4444', '#64748b'];

type PieDatum = { name: string; value: number };

function buildPieData<T>(
  items: T[],
  limit: number,
  getValue: (item: T) => number,
  getLabel: (item: T) => string
): PieDatum[] {
  const normalized = items
    .map((item) => ({
      name: getLabel(item),
      value: Number(getValue(item) || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!normalized.length || limit <= 0) return [];

  const top = normalized.slice(0, limit);
  const resto = normalized.slice(limit);
  const restoTotal = resto.reduce((acc, item) => acc + item.value, 0);

  if (restoTotal > 0) {
    top.push({ name: 'Otros', value: restoTotal });
  }

  return top;
}

function buildBudgetPie(presupuesto: number, real: number): PieDatum[] {
  if (presupuesto <= 0) return [];
  const realCap = Math.min(real, presupuesto);
  const restante = Math.max(presupuesto - real, 0);
  return [
    { name: 'Real', value: realCap },
    { name: 'Restante', value: restante },
  ];
}

function normalizePresupuestoTipo(tipo: string): 'ventas' | 'gastos' {
  const raw = (tipo || '').toLowerCase();
  if (['venta', 'ventas', 'ingreso', 'ingresos'].includes(raw)) return 'ventas';
  if (['gasto', 'gastos', 'egreso', 'egresos'].includes(raw)) return 'gastos';
  return 'gastos';
}

export default function Finanzas() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customDesde, setCustomDesde] = useState<string>('');
  const [customHasta, setCustomHasta] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('neta');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

  const [serieNeta, setSerieNeta] = useState<SerieGananciaNeta[]>([]);
  const [serieBruta, setSerieBruta] = useState<SerieGananciaBruta[]>([]);
  const [brutaResumen, setBrutaResumen] = useState<BrutaResumen>({
    totalVentas: 0,
    totalCostoProductos: 0,
    gananciaBruta: 0,
    totalDescuentos: 0,
    totalImpuestos: 0,
  });
  const [productosRentables, setProductosRentables] = useState<DetalleGananciaPorProducto[]>([]);
  const [costosProductos, setCostosProductos] = useState<DetalleCostosProducto[]>([]);
  const [rentabilidadCategorias, setRentabilidadCategorias] = useState<DetalleRentabilidadCategoria[]>([]);
  const [rentabilidadClientes, setRentabilidadClientes] = useState<DetalleRentabilidadCliente[]>([]);
  const [deudasClientesResumen, setDeudasClientesResumen] = useState<DeudaClienteResumen[]>([]);
  const [clienteDeudaSeleccionado, setClienteDeudaSeleccionado] = useState<number | null>(null);
  const [ventasPendientesCliente, setVentasPendientesCliente] = useState<VentaPendiente[]>([]);
  const [deudasProveedoresResumen, setDeudasProveedoresResumen] = useState<DeudaProveedorResumen[]>([]);
  const [diasPromedioPagoProveedores, setDiasPromedioPagoProveedores] = useState<number | null>(null);
  const [cashflowSerie, setCashflowSerie] = useState<PuntoCashflow[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [saldoMinimo, setSaldoMinimo] = useState<number>(0);
  const [saldoMaximo, setSaldoMaximo] = useState<number>(0);
  const [diasPorDebajoUmbral, setDiasPorDebajoUmbral] = useState<number>(0);
  const [umbralMinimo, setUmbralMinimo] = useState<number>(0);

  const now = new Date();
  const [presupuestoAnio, setPresupuestoAnio] = useState<number>(now.getFullYear());
  const [presupuestoMes, setPresupuestoMes] = useState<number>(now.getMonth() + 1);
  const [presupuestosMes, setPresupuestosMes] = useState<PresupuestoRow[]>([]);
  const [presupuestoVsRealRows, setPresupuestoVsRealRows] = useState<PresupuestoVsRealRow[]>([]);
  const [presupuestoTotales, setPresupuestoTotales] = useState<PresupuestoTotales>({
    presupuestoVentas: 0,
    realVentas: 0,
    presupuestoGastos: 0,
    realGastos: 0,
  });
  const [presupuestoCategorias, setPresupuestoCategorias] = useState<PresupuestoCategorias>({
    ventas: [],
    gastos: [],
  });
  const [presupuestoForm, setPresupuestoForm] = useState({
    id: undefined as number | undefined,
    tipo: 'ventas' as 'ventas' | 'gastos',
    categoria: '',
    monto: '',
  });
  const [presupuestoGuardando, setPresupuestoGuardando] = useState(false);
  const [presupuestoError, setPresupuestoError] = useState<string | null>(null);
  const [presupuestoOk, setPresupuestoOk] = useState<string | null>(null);
  const [simuladorForm, setSimuladorForm] = useState({
    aumentoPrecios: 0,
    aumentoCostos: 0,
    aumentoGastos: 0,
  });
  const [simuladorResultado, setSimuladorResultado] = useState<SimuladorResultado | null>(null);

  const range = useMemo(() => computeRange(period, customDesde, customHasta), [period, customDesde, customHasta]);

  async function handleDebug() {
    setDebugError(null);
    if (!range) {
      setDebugError('DefinÃ­ un rango de fechas para diagnosticar.');
      return;
    }
    setDebugLoading(true);
    try {
      const data = await Api.finanzasDebug({ desde: range.desde, hasta: range.hasta });
      setDebugInfo(data);
    } catch (e) {
      setDebugError(e instanceof Error ? e.message : 'No se pudo obtener el debug');
    } finally {
      setDebugLoading(false);
    }
  }

  async function loadPresupuestos(anio: number, mes: number) {
    try {
      const [presRes, vsRealRes] = await Promise.all([
        Api.presupuestos({ anio, mes }).catch(() => []),
        Api.presupuestoVsReal({ anio, mes }).catch(() => ({ items: [], totales: {} })),
      ]);

      setPresupuestosMes(
        (presRes as any[]).map((p) => ({
          id: p.id,
          anio: Number(p.anio || anio),
          mes: Number(p.mes || mes),
          tipo: normalizePresupuestoTipo(p.tipo),
          categoria: p.categoria,
          monto: Number(p.monto || 0),
        }))
      );

      setPresupuestoVsRealRows(
        ((vsRealRes as any)?.items || []).map((r: any) => ({
          tipo: r.tipo,
          categoria: r.categoria,
          presupuesto: Number(r.presupuesto || 0),
          real: Number(r.real || 0),
          diferencia: Number(r.diferencia || 0),
        }))
      );

      const totales = (vsRealRes as any)?.totales || {};
      setPresupuestoTotales({
        presupuestoVentas: Number(totales.presupuestoVentas || 0),
        realVentas: Number(totales.realVentas || 0),
        presupuestoGastos: Number(totales.presupuestoGastos || 0),
        realGastos: Number(totales.realGastos || 0),
      });
    } catch {
      setPresupuestosMes([]);
      setPresupuestoVsRealRows([]);
      setPresupuestoTotales({
        presupuestoVentas: 0,
        realVentas: 0,
        presupuestoGastos: 0,
        realGastos: 0,
      });
    }
  }

  useEffect(() => {
    if (period === 'custom' && !range) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rangeParams =
          period === 'custom' && range
            ? { desde: range.desde, hasta: range.hasta }
            : { periodo: period };
        const [netaRes, brutaRes, prodRes, costosRes, catsRes, clientesRes, cashflowRes] = await Promise.all([
          Api.gananciaNeta({ ...rangeParams }),
          Api.gananciaBruta({ ...rangeParams, agregado: 'dia' }),
          Api.gananciaPorProducto({ ...rangeParams, limit: 20, orderBy: 'ganancia' }),
          Api.costosProductos({ ...rangeParams, groupBy: 'producto' }),
          Api.rentabilidadPorCategoria({ ...rangeParams, limit: 20 }),
          Api.rentabilidadPorCliente({ ...rangeParams, limit: 20 }),
          Api.cashflow({ ...rangeParams, agrupado: 'dia' }),
        ]);

        setSerieNeta(
          (netaRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
            totalCostoProductos: Number(r.totalCostoProductos || 0),
            totalGastos: Number(r.totalGastos || 0),
            totalInversiones: Number(r.totalInversiones || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            gananciaNeta: Number(r.gananciaNeta || 0),
          }))
        );

        setSerieBruta(
          (brutaRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            totalVentas: Number(r.totalVentas || 0),
            totalCostoProductos: Number(r.totalCostoProductos || 0),
            gananciaBruta:
              r.gananciaBruta != null
                ? Number(r.gananciaBruta || 0)
                : Number(r.totalVentas || 0) - Number(r.totalCostoProductos || 0),
          }))
        );
        setBrutaResumen({
          totalVentas: Number(brutaRes?.totalVentas || 0),
          totalCostoProductos: Number(brutaRes?.totalCostoProductos || 0),
          gananciaBruta: Number(brutaRes?.gananciaBruta || 0),
          totalDescuentos: Number(brutaRes?.totalDescuentos || 0),
          totalImpuestos: Number(brutaRes?.totalImpuestos || 0),
        });

        setProductosRentables(
          (prodRes?.items || []).map((r: any) => ({
            productoId: r.productoId,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
          }))
        );

        setCostosProductos(
          (costosRes?.detalles || []).map((r: any) => ({
            productoId: r.productoId,
            productoCodigo: r.productoCodigo,
            productoNombre: r.productoNombre,
            moneda: r.moneda,
            cantidad: Number(r.cantidad || 0),
            totalCostos: Number(r.totalCostos || 0),
          }))
        );

        setRentabilidadCategorias(
          (catsRes?.items || []).map((r: any) => ({
            categoriaId: r.categoriaId ?? null,
            categoriaNombre: r.categoriaNombre,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
          }))
        );

        setRentabilidadClientes(
          (clientesRes?.items || []).map((r: any) => ({
            clienteId: r.clienteId,
            clienteNombre: r.clienteNombre,
            clienteApellido: r.clienteApellido,
            unidadesVendidas: Number(r.unidadesVendidas || 0),
            ingresos: Number(r.ingresos || 0),
            costoTotal: Number(r.costoTotal || 0),
            gananciaBruta: Number(r.gananciaBruta || 0),
            margenPorcentaje: r.margenPorcentaje != null ? Number(r.margenPorcentaje) : null,
            deuda: Number(r.deuda || 0),
          }))
        );

        setCashflowSerie(
          (cashflowRes?.serie || []).map((r: any) => ({
            fecha: r.fecha,
            entradas: Number(r.entradas || 0),
            salidas: Number(r.salidas || 0),
            saldoAcumulado: Number(r.saldoAcumulado || 0),
          }))
        );
        setSaldoInicial(Number(cashflowRes?.saldoInicial || 0));
        setSaldoMinimo(Number(cashflowRes?.saldoMinimo || 0));
        setSaldoMaximo(Number(cashflowRes?.saldoMaximo || 0));
        setDiasPorDebajoUmbral(Number(cashflowRes?.diasPorDebajoUmbral || 0));
        setUmbralMinimo(Number(cashflowRes?.umbralMinimo || 0));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos de finanzas');
        setSerieNeta([]);
        setSerieBruta([]);
        setBrutaResumen({
          totalVentas: 0,
          totalCostoProductos: 0,
          gananciaBruta: 0,
          totalDescuentos: 0,
          totalImpuestos: 0,
        });
        setProductosRentables([]);
        setCostosProductos([]);
        setRentabilidadCategorias([]);
        setRentabilidadClientes([]);
        setCashflowSerie([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [range?.desde, range?.hasta, period]);

  // Cargar deudas de clientes y proveedores (estado al día de hoy)
  useEffect(() => {
    (async () => {
      try {
        const [cliRes, provRes] = await Promise.all([
          Api.deudasClientes().catch(() => []),
          Api.deudasProveedores().catch(() => ({ items: [], diasPromedioPagoGlobal: null })),
        ]);

        const cliItems = Array.isArray(cliRes) ? cliRes : [];
        setDeudasClientesResumen(
          cliItems.map((c: any) => ({
            clienteId: c.clienteId,
            clienteNombre: c.clienteNombre,
            clienteApellido: c.clienteApellido,
            deudaTotal: Number(c.deudaTotal || 0),
            deuda0_30: Number(c.deuda0_30 || 0),
            deuda31_60: Number(c.deuda31_60 || 0),
            deuda61_90: Number(c.deuda61_90 || 0),
            deudaMas90: Number(c.deudaMas90 || 0),
            diasPromedioAtraso:
              c.diasPromedioAtraso != null ? Number(c.diasPromedioAtraso) : null,
          }))
        );

        const provObj = provRes as any;
        const itemsProv = Array.isArray(provObj?.items) ? provObj.items : [];
        setDeudasProveedoresResumen(
          itemsProv.map((p: any) => ({
            proveedorId: p.proveedorId,
            proveedorNombre: p.proveedorNombre,
            deudaTotal: Number(p.deudaTotal || 0),
            deuda0_30: Number(p.deuda0_30 || 0),
            deuda31_60: Number(p.deuda31_60 || 0),
            deuda61_90: Number(p.deuda61_90 || 0),
            deudaMas90: Number(p.deudaMas90 || 0),
            diasPromedioAtraso:
              p.diasPromedioAtraso != null ? Number(p.diasPromedioAtraso) : null,
          }))
        );
        setDiasPromedioPagoProveedores(
          provObj?.diasPromedioPagoGlobal != null
            ? Number(provObj.diasPromedioPagoGlobal)
            : null
        );
      } catch {
        setDeudasClientesResumen([]);
        setDeudasProveedoresResumen([]);
        setDiasPromedioPagoProveedores(null);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await Api.presupuestoCategorias();
        setPresupuestoCategorias({
          ventas: Array.isArray(res?.ventas) ? res.ventas : [],
          gastos: Array.isArray(res?.gastos) ? res.gastos : [],
        });
      } catch {
        setPresupuestoCategorias({ ventas: [], gastos: [] });
      }
    })();
  }, []);

  // Cargar presupuestos y presupuesto vs real para el mes seleccionado
  useEffect(() => {
    loadPresupuestos(presupuestoAnio, presupuestoMes);
  }, [presupuestoAnio, presupuestoMes]);

  const presupuestoEditando = presupuestoForm.id != null;
  const categoriasSugeridas =
    presupuestoForm.tipo === 'ventas' ? presupuestoCategorias.ventas : presupuestoCategorias.gastos;

  async function handleGuardarPresupuesto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPresupuestoError(null);
    setPresupuestoOk(null);

    const categoria = presupuestoForm.categoria.trim();
    const monto = Number(presupuestoForm.monto);

    if (!categoria) {
      setPresupuestoError('Categoria requerida');
      return;
    }
    if (!Number.isFinite(monto) || monto < 0) {
      setPresupuestoError('Monto invalido');
      return;
    }

    setPresupuestoGuardando(true);
    try {
      await Api.guardarPresupuesto({
        anio: presupuestoAnio,
        mes: presupuestoMes,
        tipo: presupuestoForm.tipo,
        categoria,
        monto,
      });
      setPresupuestoOk('Presupuesto guardado');
      setPresupuestoForm({
        id: undefined,
        tipo: presupuestoForm.tipo,
        categoria: '',
        monto: '',
      });
      await loadPresupuestos(presupuestoAnio, presupuestoMes);
    } catch (e) {
      setPresupuestoError(e instanceof Error ? e.message : 'No se pudo guardar el presupuesto');
    } finally {
      setPresupuestoGuardando(false);
    }
  }

  function handleEditarPresupuesto(row: PresupuestoRow) {
    setPresupuestoForm({
      id: row.id,
      tipo: normalizePresupuestoTipo(row.tipo),
      categoria: row.categoria,
      monto: row.monto.toString(),
    });
  }

  function handleCancelarPresupuesto() {
    setPresupuestoForm({
      id: undefined,
      tipo: 'ventas',
      categoria: '',
      monto: '',
    });
    setPresupuestoError(null);
    setPresupuestoOk(null);
  }

  async function handleEliminarPresupuesto(row: PresupuestoRow) {
    if (!row.id) return;
    if (!window.confirm('Eliminar presupuesto seleccionado?')) return;
    setPresupuestoError(null);
    setPresupuestoOk(null);
    try {
      await Api.eliminarPresupuesto(row.id);
      setPresupuestoOk('Presupuesto eliminado');
      if (presupuestoForm.id === row.id) {
        handleCancelarPresupuesto();
      }
      await loadPresupuestos(presupuestoAnio, presupuestoMes);
    } catch (e) {
      setPresupuestoError(e instanceof Error ? e.message : 'No se pudo eliminar el presupuesto');
    }
  }

  const chartGananciaNeta = useMemo(
    () =>
      serieNeta.map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
        costo: r.totalCostoProductos,
        gastos: r.totalGastos + r.totalInversiones,
        neta: r.gananciaNeta,
      })),
    [serieNeta]
  );

  const chartGananciaBruta = useMemo(
    () =>
      serieBruta.map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        ventas: r.totalVentas,
        costo: r.totalCostoProductos,
        bruta: r.gananciaBruta,
      })),
    [serieBruta]
  );

  const chartCashflow = useMemo(
    () =>
      cashflowSerie.map((p) => ({
        fecha: new Date(p.fecha).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        entradas: p.entradas,
        salidas: p.salidas,
        saldo: p.saldoAcumulado,
      })),
    [cashflowSerie]
  );

  const totalGananciaNeta = useMemo(
    () => serieNeta.reduce((acc, r) => acc + r.gananciaNeta, 0),
    [serieNeta]
  );

  const totalCostosPeriodo = useMemo(
    () => costosProductos.reduce((acc, r) => acc + r.totalCostos, 0),
    [costosProductos]
  );

  const totalPresupuestoMes = useMemo(
    () => presupuestoVsRealRows.reduce((acc, r) => acc + r.presupuesto, 0),
    [presupuestoVsRealRows]
  );

  const totalRealMes = useMemo(
    () => presupuestoVsRealRows.reduce((acc, r) => acc + r.real, 0),
    [presupuestoVsRealRows]
  );

  const margenBruto = useMemo(() => {
    if (!brutaResumen.totalVentas) return 0;
    return (brutaResumen.gananciaBruta / brutaResumen.totalVentas) * 100;
  }, [brutaResumen]);

  const pieVentasCosto = useMemo(() => {
    if (!brutaResumen.totalVentas && !brutaResumen.totalCostoProductos) return [];
    return [
      { name: 'Costo productos', value: Math.max(brutaResumen.totalCostoProductos, 0) },
      { name: 'Ganancia bruta', value: Math.max(brutaResumen.gananciaBruta, 0) },
    ];
  }, [brutaResumen]);

  const pieCategoriasGanancia = useMemo(
    () => buildPieData(rentabilidadCategorias, 6, (c) => c.gananciaBruta, (c) => c.categoriaNombre),
    [rentabilidadCategorias]
  );

  const pieProductosGanancia = useMemo(
    () => buildPieData(productosRentables, 6, (p) => p.gananciaBruta, (p) => p.productoNombre),
    [productosRentables]
  );

  const presupuestoVentasPie = useMemo(
    () => buildBudgetPie(presupuestoTotales.presupuestoVentas, presupuestoTotales.realVentas),
    [presupuestoTotales]
  );

  const presupuestoGastosPie = useMemo(
    () => buildBudgetPie(presupuestoTotales.presupuestoGastos, presupuestoTotales.realGastos),
    [presupuestoTotales]
  );

  const presupuestoVentasExceso = useMemo(
    () => Math.max(presupuestoTotales.realVentas - presupuestoTotales.presupuestoVentas, 0),
    [presupuestoTotales]
  );

  const presupuestoGastosExceso = useMemo(
    () => Math.max(presupuestoTotales.realGastos - presupuestoTotales.presupuestoGastos, 0),
    [presupuestoTotales]
  );

  const topProducto = useMemo(() => productosRentables[0] ?? null, [productosRentables]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold bg-gradient-to-r from-slate-100 via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
            Finanzas
          </div>
          {range ? (
            <div className="text-xs text-slate-400 font-data mt-1">
              {range.desde} a {range.hasta}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-1">Rango sin definir</div>
          )}
          <div className="text-[11px] text-slate-500 mt-1">Panel de costos y rentabilidad</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-[0.2em]">Periodo</span>
            <select
              className="input-modern text-xs h-8"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
            >
              <option value="24h">Ultimas 24h</option>
              <option value="7d">Ultimos 7 dias</option>
              <option value="30d">Ultimos 30 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
              <span className="text-[11px] text-slate-400 uppercase tracking-[0.2em]">Rango</span>
              <input
                type="date"
                className="input-modern text-xs h-8"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
              />
              <input
                type="date"
                className="input-modern text-xs h-8"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="app-card border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="app-card finance-card p-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Acciones</div>
            <div className="text-sm text-slate-200">Diagnostico rapido del periodo</div>
            {debugError && <div className="text-xs text-rose-300 mt-1">{debugError}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleDebug}
              disabled={debugLoading}
              className="h-9 px-3 text-xs"
            >
              {debugLoading ? 'Revisando...' : 'Verificar ventas/gastos'}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs">
              Diagnostico
            </Button>
            <Button type="button" variant="outline" className="h-9 px-3 text-xs">
              Exportar datos
            </Button>
          </div>
        </div>
        {debugInfo && (
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-slate-200">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="app-card finance-card p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Ganancia neta del periodo</div>
          <div className="text-2xl font-semibold font-data text-emerald-200">
            ${totalGananciaNeta.toFixed(0)}
          </div>
          <div className="text-xs text-slate-500 mt-2">Resultado consolidado del rango actual</div>
        </div>
        <div className="app-card finance-card p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Costos de productos</div>
          <div className="text-2xl font-semibold font-data text-cyan-200">
            ${totalCostosPeriodo.toFixed(0)}
          </div>
          <div className="text-xs text-slate-500 mt-2">Total del periodo seleccionado</div>
        </div>
        <div className="app-card finance-card p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Producto mas rentable</div>
          {topProducto ? (
            <div>
              <div className="text-sm font-medium text-slate-100">
                {topProducto.productoNombre}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Ganancia bruta: ${topProducto.gananciaBruta.toFixed(0)}{' '}
                {topProducto.margenPorcentaje != null && `(${topProducto.margenPorcentaje.toFixed(1)}%)`}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Sin datos en el periodo</div>
          )}
        </div>
      </div>

      <div className="finance-tablist app-scrollbar">
        {[
          { key: 'bruta', label: 'Ganancia bruta' },
          { key: 'neta', label: 'Ganancia neta' },
          { key: 'producto', label: 'Ganancia por producto' },
          { key: 'costos', label: 'Costos de productos' },
          { key: 'categorias', label: 'Por categoria' },
          { key: 'clientes', label: 'Por cliente' },
          { key: 'cashflow', label: 'Flujo de caja' },
          { key: 'presupuestos', label: 'Presupuestos' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`finance-tab ${tab === (t.key as TabKey) ? 'active' : ''}`}
            onClick={() => setTab(t.key as TabKey)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'neta' && (
        <div className="app-card finance-card p-4">
          <div className="text-sm text-slate-300 mb-2">Ganancias brutas vs. netas</div>
          <div className="h-72 finance-shimmer">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartGananciaNeta}>
                <XAxis dataKey="fecha" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  wrapperStyle={{ outline: 'none' }}
                  contentStyle={{
                    background: 'rgba(2,6,23,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#4f46e5"
                  fill="#6366f1"
                  fillOpacity={0.25}
                  name="Ventas"
                />
                <Area
                  type="monotone"
                  dataKey="neta"
                  stroke="#06b6d4"
                  fill="#22d3ee"
                  fillOpacity={0.25}
                  name="Ganancia neta"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'bruta' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="app-card finance-card p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Ventas netas</div>
              <div className="text-2xl font-semibold font-data text-slate-100">
                ${brutaResumen.totalVentas.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Descuentos: {brutaResumen.totalDescuentos.toLocaleString(undefined, { maximumFractionDigits: 0 })} -
                Impuestos: {brutaResumen.totalImpuestos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="app-card finance-card p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Costo productos vendidos</div>
              <div className="text-2xl font-semibold font-data text-cyan-200">
                ${brutaResumen.totalCostoProductos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-slate-500 mt-2">Costo total del periodo</div>
            </div>
            <div className="app-card finance-card p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Ganancia bruta</div>
              <div className="text-2xl font-semibold font-data text-emerald-200">
                ${brutaResumen.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-slate-500 mt-2">Ventas menos costos</div>
            </div>
            <div className="app-card finance-card p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Margen bruto</div>
              <div className="text-2xl font-semibold font-data text-fuchsia-200">
                {margenBruto.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-2">Ganancia bruta / ventas</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="app-card finance-card p-4 lg:col-span-2">
              <div className="text-sm text-slate-300 mb-2">Ventas, costo y ganancia bruta</div>
              <div className="h-72 finance-shimmer">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartGananciaBruta}>
                    <XAxis dataKey="fecha" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      wrapperStyle={{ outline: 'none' }}
                      contentStyle={{
                        background: 'rgba(2,6,23,0.92)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#e2e8f0',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="#4f46e5"
                      fill="#6366f1"
                      fillOpacity={0.2}
                      name="Ventas"
                    />
                    <Area
                      type="monotone"
                      dataKey="costo"
                      stroke="#ef4444"
                      fill="#fca5a5"
                      fillOpacity={0.2}
                      name="Costo productos"
                    />
                    <Line
                      type="monotone"
                      dataKey="bruta"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      name="Ganancia bruta"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="app-card finance-card p-4">
              <div className="text-sm text-slate-300 mb-2">Estructura de ganancia bruta</div>
              <div className="h-72 finance-shimmer">
                {pieVentasCosto.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin datos para el periodo.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieVentasCosto}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {pieVentasCosto.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        wrapperStyle={{ outline: 'none' }}
                        contentStyle={{
                          background: 'rgba(2,6,23,0.92)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          color: '#e2e8f0',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="app-card finance-card p-4">
              <div className="text-sm text-slate-300 mb-2">Ganancia bruta por categoria</div>
              <div className="h-72 finance-shimmer">
                {pieCategoriasGanancia.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin datos para el periodo.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieCategoriasGanancia}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {pieCategoriasGanancia.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        wrapperStyle={{ outline: 'none' }}
                        contentStyle={{
                          background: 'rgba(2,6,23,0.92)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          color: '#e2e8f0',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="app-card finance-card p-4">
              <div className="text-sm text-slate-300 mb-2">Ganancia bruta por producto</div>
              <div className="h-72 finance-shimmer">
                {pieProductosGanancia.length === 0 ? (
                  <div className="text-sm text-slate-500">Sin datos para el periodo.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieProductosGanancia}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {pieProductosGanancia.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        wrapperStyle={{ outline: 'none' }}
                        contentStyle={{
                          background: 'rgba(2,6,23,0.92)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                          color: '#e2e8f0',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'costos' && (
        <div className="app-card finance-card p-4">
          <div className="text-sm text-slate-300 mb-2">Costos de productos por artículo</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Cantidad</th>
                  <th className="py-2 px-2 text-right">Costo total</th>
                  <th className="py-2 px-2">Moneda</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {costosProductos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      Sin movimientos de compras en el período.
                    </td>
                  </tr>
                )}
                {costosProductos.map((r) => (
                  <tr key={r.productoId} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2 px-2">{r.productoCodigo}</td>
                    <td className="py-2 px-2">{r.productoNombre}</td>
                    <td className="py-2 px-2 text-right">{r.cantidad}</td>
                    <td className="py-2 px-2 text-right">
                      {r.totalCostos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2">{r.moneda}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categorias' && (
        <div className="app-card finance-card p-4">
          <div className="text-sm text-slate-300 mb-2">Rentabilidad por categoría</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Categoría</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rentabilidadCategorias.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {rentabilidadCategorias.map((c) => (
                  <tr key={c.categoriaId ?? c.categoriaNombre} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2 px-2">{c.categoriaNombre}</td>
                    <td className="py-2 px-2 text-right">{c.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right">
                      {c.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.margenPorcentaje != null ? `${c.margenPorcentaje.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clientes' && (
          <div className="app-card finance-card p-4">
          <div className="text-sm text-slate-300 mb-2">Rentabilidad por cliente (ventas y deuda)</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Cliente</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                  <th className="py-2 px-2 text-right">Deuda</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rentabilidadClientes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {rentabilidadClientes.map((c) => (
                  <tr key={c.clienteId} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2 px-2">
                      {c.clienteNombre}
                      {c.clienteApellido ? ` ${c.clienteApellido}` : ''}
                    </td>
                    <td className="py-2 px-2 text-right">{c.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right">
                      {c.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.margenPorcentaje != null ? `${c.margenPorcentaje.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {c.deuda.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'cashflow' && (
          <div className="app-card finance-card p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-sm text-slate-300 mb-1">Flujo de caja diario</div>
                <div className="text-xs text-slate-500">
                  Saldo inicial:{' '}
                  <span className="font-medium text-slate-200 dark:text-slate-200">
                    {saldoInicial.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {' · '}Saldo mГ­nimo:{' '}
                  <span className="font-medium text-slate-200 dark:text-slate-200">
                    {saldoMinimo.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {' · '}Saldo mГЎximo:{' '}
                  <span className="font-medium text-slate-200 dark:text-slate-200">
                    {saldoMaximo.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  DГ­as por debajo del umbral ({umbralMinimo.toLocaleString(undefined, { maximumFractionDigits: 0 })}):{' '}
                  <span className="font-medium text-slate-200 dark:text-slate-200">
                    {diasPorDebajoUmbral}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-72 finance-shimmer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartCashflow}>
                  <XAxis dataKey="fecha" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                  wrapperStyle={{ outline: 'none' }}
                  contentStyle={{
                    background: 'rgba(2,6,23,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                  }}
                />
                  <Area
                    type="monotone"
                    dataKey="entradas"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.25}
                    name="Entradas"
                  />
                  <Area
                    type="monotone"
                    dataKey="salidas"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.18}
                    name="Salidas"
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    stroke="#0ea5e9"
                    fill="#0ea5e9"
                    fillOpacity={0.12}
                    name="Saldo acumulado"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === 'presupuestos' && (
          <div className="app-card finance-card p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-sm text-slate-300 mb-1">Presupuesto vs real por categoria</div>
                <div className="text-xs text-slate-500">
                  Total presupuesto:{' '}
                  <span className="font-medium text-slate-200 dark:text-slate-200">
                    {totalPresupuestoMes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  {' - '}Total real:{' '}
                  <span className="font-medium text-slate-200 dark:text-slate-200">
                    {totalRealMes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Anio</label>
                  <input
                    type="number"
                    className="input-modern text-xs md:text-sm w-24"
                    value={presupuestoAnio}
                    onChange={(e) => setPresupuestoAnio(Number(e.target.value) || presupuestoAnio)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Mes</label>
                  <select
                    className="input-modern text-xs md:text-sm w-28"
                    value={presupuestoMes}
                    onChange={(e) => setPresupuestoMes(Number(e.target.value) || presupuestoMes)}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="h-72 lg:col-span-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={presupuestoVsRealRows.map((r) => ({
                      label: `${r.tipo === 'ventas' ? 'Ventas' : 'Gastos'} - ${r.categoria}`,
                      presupuesto: r.presupuesto,
                      real: r.real,
                    }))}
                    margin={{ left: 0, right: 0 }}
                  >
                    <XAxis dataKey="label" hide />
                    <YAxis />
                    <Tooltip formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                    <Bar dataKey="presupuesto" stackId="a" fill="#6366f1" name="Presupuesto" />
                    <Bar dataKey="real" stackId="a" fill="#f59e0b" name="Real" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="app-panel p-3 space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Ventas</div>
                  <div className="h-36">
                    {presupuestoVentasPie.length === 0 ? (
                      <div className="text-xs text-slate-500">Sin presupuesto de ventas.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={presupuestoVentasPie} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60}>
                            {presupuestoVentasPie.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Presupuesto: {presupuestoTotales.presupuestoVentas.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                    - Real: {presupuestoTotales.realVentas.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  {presupuestoVentasExceso > 0 && (
                    <div className="text-xs text-amber-600 mt-1">
                      Exceso: {presupuestoVentasExceso.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Gastos</div>
                  <div className="h-36">
                    {presupuestoGastosPie.length === 0 ? (
                      <div className="text-xs text-slate-500">Sin presupuesto de gastos.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={presupuestoGastosPie} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60}>
                            {presupuestoGastosPie.map((entry, index) => (
                              <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Presupuesto: {presupuestoTotales.presupuestoGastos.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                    - Real: {presupuestoTotales.realGastos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  {presupuestoGastosExceso > 0 && (
                    <div className="text-xs text-amber-600 mt-1">
                      Exceso: {presupuestoGastosExceso.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2">Categoria</th>
                      <th className="py-2 px-2 text-right">Presupuesto</th>
                      <th className="py-2 px-2 text-right">Real</th>
                      <th className="py-2 px-2 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {presupuestoVsRealRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">
                          Sin datos de presupuesto para el mes seleccionado.
                        </td>
                      </tr>
                    )}
                    {presupuestoVsRealRows.map((r, idx) => (
                      <tr key={`${r.tipo}-${r.categoria}-${idx}`} className="border-t border-white/10 hover:bg-white/5">
                        <td className="py-2 px-2 capitalize">{r.tipo}</td>
                        <td className="py-2 px-2">{r.categoria}</td>
                        <td className="py-2 px-2 text-right">
                          {r.presupuesto.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {r.real.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {r.diferencia.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <div className="app-panel p-3">
                  <div className="text-sm text-slate-300 mb-2">
                    {presupuestoEditando ? 'Editar presupuesto' : 'Nuevo presupuesto'}
                  </div>
                  <form className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end" onSubmit={handleGuardarPresupuesto}>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Tipo</label>
                      <select
                        className="input-modern text-xs md:text-sm w-full"
                        value={presupuestoForm.tipo}
                        onChange={(e) =>
                          setPresupuestoForm((prev) => ({ ...prev, tipo: e.target.value as 'ventas' | 'gastos' }))
                        }
                      >
                        <option value="ventas">Ventas</option>
                        <option value="gastos">Gastos</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Categoria</label>
                      <input
                        className="input-modern text-xs md:text-sm w-full"
                        value={presupuestoForm.categoria}
                        list="presupuesto-categorias"
                        onChange={(e) => setPresupuestoForm((prev) => ({ ...prev, categoria: e.target.value }))}
                        placeholder="Ej: Servicios"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Monto</label>
                      <input
                        type="number"
                        min="0"
                        className="input-modern text-xs md:text-sm w-full"
                        value={presupuestoForm.monto}
                        onChange={(e) => setPresupuestoForm((prev) => ({ ...prev, monto: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={presupuestoGuardando}>
                        {presupuestoEditando ? 'Actualizar' : 'Guardar'}
                      </Button>
                      {presupuestoEditando && (
                        <Button type="button" variant="ghost" onClick={handleCancelarPresupuesto}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>
                  <datalist id="presupuesto-categorias">
                    {categoriasSugeridas.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                  {presupuestoError && (
                    <div className="text-xs text-red-600 mt-2">{presupuestoError}</div>
                  )}
                  {presupuestoOk && (
                    <div className="text-xs text-emerald-600 mt-2">{presupuestoOk}</div>
                  )}
                </div>

                <div className="app-panel p-3">
                  <div className="text-sm text-slate-300 mb-2">Presupuestos del mes</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="py-2 px-2">Tipo</th>
                          <th className="py-2 px-2">Categoria</th>
                          <th className="py-2 px-2 text-right">Monto</th>
                          <th className="py-2 px-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {presupuestosMes.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-500">
                              Sin presupuestos cargados.
                            </td>
                          </tr>
                        )}
                        {presupuestosMes.map((p) => (
                          <tr key={p.id ?? `${p.tipo}-${p.categoria}`} className="border-t border-white/10 hover:bg-white/5">
                            <td className="py-2 px-2 capitalize">{p.tipo}</td>
                            <td className="py-2 px-2">{p.categoria}</td>
                            <td className="py-2 px-2 text-right">
                              {p.monto.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2 px-2 text-right space-x-2">
                              <button
                                type="button"
                                className="text-indigo-600 hover:text-indigo-500 text-xs"
                                onClick={() => handleEditarPresupuesto(p)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-rose-600 hover:text-rose-500 text-xs"
                                onClick={() => handleEliminarPresupuesto(p)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'producto' && (
        <div className="app-card finance-card p-4">
          <div className="text-sm text-slate-300 mb-2">Top productos por ganancia bruta</div>
          <div className="h-72 mb-4 finance-shimmer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productosRentables.map((p) => ({
                  nombre: p.productoNombre,
                  ganancia: p.gananciaBruta,
                }))}
                margin={{ left: 0, right: 0 }}
              >
                <XAxis dataKey="nombre" hide />
                <YAxis />
                <Tooltip
                  wrapperStyle={{ outline: 'none' }}
                  contentStyle={{
                    background: 'rgba(2,6,23,0.92)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e2e8f0',
                  }}
                />
                <Bar dataKey="ganancia" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-right">Unidades</th>
                  <th className="py-2 px-2 text-right">Ingresos</th>
                  <th className="py-2 px-2 text-right">Costo</th>
                  <th className="py-2 px-2 text-right">Ganancia</th>
                  <th className="py-2 px-2 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {productosRentables.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {productosRentables.map((p) => (
                  <tr key={p.productoId} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2 px-2 font-data text-cyan-200">{p.productoCodigo}</td>
                    <td className="py-2 px-2">{p.productoNombre}</td>
                    <td className="py-2 px-2 text-right font-data">{p.unidadesVendidas}</td>
                    <td className="py-2 px-2 text-right font-data">
                      {p.ingresos.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right font-data">
                      {p.costoTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right font-data">
                      {p.gananciaBruta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {p.margenPorcentaje != null ? (
                        <span className={`finance-badge ${p.margenPorcentaje >= 40 ? 'high' : p.margenPorcentaje >= 20 ? 'mid' : 'low'}`}>
                          {p.margenPorcentaje.toFixed(1)}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-500">
          Cargando datos financieros...
        </div>
      )}
    </div>
  );
}
