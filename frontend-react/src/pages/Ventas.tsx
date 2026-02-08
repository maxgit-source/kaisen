import { useCallback, useEffect, useMemo, useState } from 'react';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { Api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getRoleFromToken } from '../lib/auth';
import { usePriceLabels } from '../lib/priceLabels';

type Cliente = { id: number; nombre: string; apellido?: string };
type Producto = {
  id: number;
  name: string;
  price: number;
  category_name?: string;
  precio_final?: number | null;
  price_local?: number | null;
  price_distribuidor?: number | null;
  costo_pesos?: number | null;
  costo_dolares?: number | null;
  margen_local?: number | null;
  margen_distribuidor?: number | null;
};
type Venta = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  fecha: string;
  total: number;
  descuento: number;
  impuestos: number;
  neto: number;
  estado_pago: string;
  estado_entrega?: 'pendiente' | 'entregado';
  caja_tipo?: 'home_office' | 'sucursal';
  oculto?: boolean;
  es_reserva?: boolean;
};

type Deposito = {
  id: number;
  nombre: string;
  codigo?: string | null;
};

type VentaDetalleItem = {
  id: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type ItemDraft = {
	producto_id: number | '';
	cantidad: string;
	precio_unitario: string;
  };
type ReferidoInfo = {
  codigo: string;
  descuento_aplicado: number;
  comision_monto: number;
  alianza_nombre?: string | null;
  pyme_nombre?: string | null;
};

type FacturaInfo = {
  id: number;
  estado: string;
  numero_factura?: string | null;
  cae?: string | null;
  cae_vto?: string | null;
  error?: string | null;
  total?: number | null;
  tipo_comprobante?: string | null;
  punto_venta?: number | null;
};

type PuntoVentaArca = {
  id: number;
  punto_venta: number;
  nombre?: string | null;
  activo?: boolean | number;
};

export default function Ventas() {
  const { accessToken } = useAuth();
  const role = useMemo(() => getRoleFromToken(accessToken), [accessToken]);
  const canOverrideComprobante = role === 'admin' || role === 'gerente';
  const { labels: priceLabels } = usePriceLabels();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [depositoId, setDepositoId] = useState<number | ''>('');
  const [esReserva, setEsReserva] = useState(false);
  const [detalleVenta, setDetalleVenta] = useState<{
    abierto: boolean;
    venta: Venta | null;
    items: VentaDetalleItem[];
    loading: boolean;
    error: string | null;
  }>({
    abierto: false,
    venta: null,
    items: [],
    loading: false,
    error: null,
  });
  const [remitoModal, setRemitoModal] = useState<{
    abierto: boolean;
    venta: Venta | null;
    observaciones: string;
    loading: boolean;
    error: string | null;
  }>({
    abierto: false,
    venta: null,
    observaciones: '',
    loading: false,
    error: null,
  });

  // Nueva venta state
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 16)); // yyyy-MM-ddTHH:mm
  const [descuento, setDescuento] = useState<number>(0);
  const [impuestos, setImpuestos] = useState<number>(0);
  const [items, setItems] = useState<ItemDraft[]>([{ producto_id: '', cantidad: '1', precio_unitario: '' }]);
  const [error, setError] = useState<string>('');
  const [priceType, setPriceType] = useState<'local' | 'distribuidor' | 'final'>('local');
  const [referidoCodigo, setReferidoCodigo] = useState('');
  const [referidoInfo, setReferidoInfo] = useState<ReferidoInfo | null>(null);
  const [referidoError, setReferidoError] = useState('');
  const [referidoLoading, setReferidoLoading] = useState(false);
  const [facturaInfo, setFacturaInfo] = useState<FacturaInfo | null>(null);
  const [facturaSnapshot, setFacturaSnapshot] = useState<any>(null);
  const [facturaLoading, setFacturaLoading] = useState(false);
  const [facturaError, setFacturaError] = useState<string | null>(null);
  const [emitLoading, setEmitLoading] = useState(false);
  const [puntosVentaArca, setPuntosVentaArca] = useState<PuntoVentaArca[]>([]);
  const [emitForm, setEmitForm] = useState({
    punto_venta_id: '',
    tipo_comprobante: '',
    concepto: '1',
    fecha_serv_desde: '',
    fecha_serv_hasta: '',
    fecha_vto_pago: '',
  });

  async function loadAll() {
    setLoading(true);
    try {
      const [v, c, p, d] = await Promise.all([
        Api.ventas(),
        Api.clientes({ all: true }),
        Api.productos({ all: true }),
        Api.depositos(),
      ]);
      setVentas(v || []);
      setClientes(c || []);
      setProductos(
        (p || []).map((r: any) => ({
          id: Number(r.id),
          name: r.name,
          price: Number(r.price || 0),
          category_name: r.category_name,
          precio_final:
            typeof r.precio_final !== 'undefined' && r.precio_final !== null
              ? Number(r.precio_final)
              : null,
          price_local:
            typeof r.price_local !== 'undefined' && r.price_local !== null
              ? Number(r.price_local)
              : null,
          price_distribuidor:
            typeof r.price_distribuidor !== 'undefined' && r.price_distribuidor !== null
              ? Number(r.price_distribuidor)
              : null,
          costo_pesos:
            typeof r.costo_pesos !== 'undefined' && r.costo_pesos !== null
              ? Number(r.costo_pesos)
              : null,
          costo_dolares:
            typeof r.costo_dolares !== 'undefined' && r.costo_dolares !== null
              ? Number(r.costo_dolares)
              : null,
          margen_local:
            typeof r.margen_local !== 'undefined' && r.margen_local !== null
              ? Number(r.margen_local)
              : null,
            margen_distribuidor:
              typeof r.margen_distribuidor !== 'undefined' && r.margen_distribuidor !== null
                ? Number(r.margen_distribuidor)
                : null,
          })),
      );
      const deps: Deposito[] = (d || []).map((dep: any) => ({
        id: dep.id,
        nombre: dep.nombre,
        codigo: dep.codigo ?? null,
      }));
      setDepositos(deps);
      if (!depositoId && deps.length > 0) {
        setDepositoId(deps[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadArcaSupport() {
    try {
      const pvs = await Api.arcaPuntosVenta();
      setPuntosVentaArca((pvs || []) as PuntoVentaArca[]);
    } catch {
      setPuntosVentaArca([]);
    }
  }

  useEffect(() => {
    loadAll();
    loadArcaSupport();
  }, []);

  const productosById = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const calculatePriceByType = useCallback((prod: Producto | undefined) => {
    if (!prod) return 0;
    const basePrice = Number(prod.price || 0);
    const costoPesos = typeof prod.costo_pesos === 'number' ? prod.costo_pesos || 0 : 0;
    const margenLocal =
      typeof prod.margen_local === 'number' && prod.margen_local !== null
        ? prod.margen_local
        : 0.15;
    const margenDistribuidor =
      typeof prod.margen_distribuidor === 'number' && prod.margen_distribuidor !== null
        ? prod.margen_distribuidor
        : 0.45;

    const precioLocalCalc = costoPesos > 0 ? costoPesos * (1 + margenLocal) : 0;
    const precioDistribuidorCalc = costoPesos > 0 ? costoPesos * (1 + margenDistribuidor) : 0;

    let priceToUse = 0;

    switch (priceType) {
      case 'final': {
        const finalManual =
          typeof prod.precio_final === 'number' && prod.precio_final > 0 ? prod.precio_final : 0;
        priceToUse = finalManual || precioLocalCalc || basePrice || precioDistribuidorCalc;
        break;
      }
      case 'distribuidor': {
        const dist =
          typeof prod.price_distribuidor === 'number' && prod.price_distribuidor > 0
            ? prod.price_distribuidor
            : 0;
        priceToUse = dist || precioDistribuidorCalc || basePrice || precioLocalCalc;
        break;
      }
      case 'local':
      default: {
        const local =
          typeof prod.price_local === 'number' && prod.price_local > 0 ? prod.price_local : 0;
        priceToUse = local || precioLocalCalc || basePrice || precioDistribuidorCalc;
        break;
      }
    }

    try {
      console.log('[Ventas] auto precio', {
        priceType,
        prodId: prod.id,
        basePrice,
        precio_local: prod.price_local,
        precio_distribuidor: prod.price_distribuidor,
        precio_final: prod.precio_final,
        costo_pesos: prod.costo_pesos,
        margen_local: prod.margen_local,
        margen_distribuidor: prod.margen_distribuidor,
        precioLocalCalc,
        precioDistribuidorCalc,
        priceToUse,
      });
    } catch {}

    return priceToUse > 0 ? priceToUse : 0;
  }, [priceType]);

  // Recalculate all item prices when the global priceType changes
  useEffect(() => {
    setItems(prevItems =>
      prevItems.map(it => {
        const prod = productosById.get(Number(it.producto_id));
        const newAutoPrice = calculatePriceByType(prod);
        // Only update the price if the product is already selected
        if (it.producto_id) {
          return { ...it, precio_unitario: newAutoPrice > 0 ? String(newAutoPrice) : '' };
        }
        return it;
      })
    );
  }, [priceType, productosById, calculatePriceByType]);
  

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const unit = Number(it.precio_unitario || 0);
      const qty = Number(it.cantidad || 0);
      return acc + unit * qty;
    }, 0);
  }, [items]);

  const referidoDescuento = useMemo(
    () => Number(referidoInfo?.descuento_aplicado || 0),
    [referidoInfo]
  );
  const neto = useMemo(
    () => subtotal - (descuento || 0) - referidoDescuento + (impuestos || 0),
    [subtotal, descuento, referidoDescuento, impuestos]
  );
  const totalDetalle = useMemo(
    () => detalleVenta.items.reduce((acc, it) => acc + Number(it.subtotal || 0), 0),
    [detalleVenta.items]
  );

  function addItemRow() { setItems(prev => [...prev, { producto_id: '', cantidad: '1', precio_unitario: '' }]); }
  function removeItemRow(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  useEffect(() => {
    if (!referidoCodigo.trim()) {
      setReferidoInfo(null);
      setReferidoError('');
    }
  }, [referidoCodigo]);

  async function validarReferido() {
    const code = referidoCodigo.trim();
    if (!code) {
      setReferidoError('Ingresa un codigo de referido');
      setReferidoInfo(null);
      return;
    }
    setReferidoLoading(true);
    setReferidoError('');
    try {
      const data = await Api.marketplaceValidarReferido({ codigo: code, total: subtotal });
      setReferidoInfo(data as ReferidoInfo);
    } catch (e: any) {
      setReferidoInfo(null);
      setReferidoError(e?.message || 'No se pudo validar el referido');
    } finally {
      setReferidoLoading(false);
    }
  }

  async function submitVenta() {
    setError('');
    try {
      if (!clienteId) {
        setError('Selecciona un cliente');
        return;
      }
      const cleanItems = items
        .map(it => ({
          producto_id: Number(it.producto_id),
          cantidad: Math.max(1, parseInt(it.cantidad || '0', 10) || 0),
          precio_unitario: Number(it.precio_unitario || 0),
        }))
        .filter(it => it.producto_id > 0 && it.cantidad > 0 && it.precio_unitario > 0);

      if (!cleanItems.length) {
        setError('Agrega al menos un producto con cantidad y precio vÃ¡lidos');
        return;
      }
      const body = {
        cliente_id: Number(clienteId),
        fecha: new Date(fecha).toISOString(),
        descuento: Number(descuento || 0),
        impuestos: Number(impuestos || 0),
        items: cleanItems,
        deposito_id: depositoId ? Number(depositoId) : undefined,
        es_reserva: Boolean(esReserva),
        referido_codigo: referidoCodigo.trim() || undefined,
      };

      await Api.crearVenta(body);
      // reset form
      setClienteId('');
      setFecha(new Date().toISOString().slice(0,16));
      setDescuento(0);
      setImpuestos(0);
      setItems([{ producto_id: '', cantidad: '1', precio_unitario: '' }]);
      setEsReserva(false);
      setReferidoCodigo('');
      setReferidoInfo(null);
      setReferidoError('');
      setOpen(false);
      await loadAll();
    } catch (e: any) {
      if (import.meta?.env?.DEV) {
        console.error('[Ventas] Error creando venta', e);
      }
      setError(e?.message || 'Error al crear la venta');
    }
  }

  async function ocultarVenta(venta: Venta) {
    if (!window.confirm(`Â¿Ocultar la venta #${venta.id} del listado principal?`)) return;
    try {
      await Api.ocultarVenta(venta.id);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || 'No se pudo ocultar la venta');
    }
  }

  async function cancelarVenta(venta: Venta) {
    const entregada = (venta.estado_entrega || 'pendiente') === 'entregado';
    if (entregada) {
      alert('No se puede cancelar una venta ya entregada.');
      return;
    }
    const motivo = window.prompt('Motivo de cancelacion (opcional):', '');
    if (motivo === null) return;
    try {
      await Api.cancelarVenta(venta.id, motivo ? { motivo } : {});
      await loadAll();
    } catch (e: any) {
      alert(e?.message || 'No se pudo cancelar la venta');
    }
  }

  function canEntregarVenta(venta: Venta) {
    if ((venta.estado_entrega || 'pendiente') !== 'pendiente') return false;
    const caja = venta.caja_tipo || 'sucursal';
    if (caja === 'home_office') {
      return role === 'admin';
    }
    return true;
  }

  function abrirRemitoModal(venta: Venta) {
    setRemitoModal({
      abierto: true,
      venta,
      observaciones: '',
      loading: false,
      error: null,
    });
  }

  function cerrarRemitoModal() {
    setRemitoModal({
      abierto: false,
      venta: null,
      observaciones: '',
      loading: false,
      error: null,
    });
  }

  async function descargarRemitoPdf() {
    if (!remitoModal.venta || remitoModal.loading) return;
    setRemitoModal((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const blob = await Api.descargarRemito(remitoModal.venta.id, remitoModal.observaciones);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remito-${remitoModal.venta.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      cerrarRemitoModal();
    } catch (e: any) {
      setRemitoModal((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || 'No se pudo descargar el remito',
      }));
    }
  }

  async function loadFactura(ventaId: number) {
    setFacturaLoading(true);
    setFacturaError(null);
    try {
      const data: any = await Api.arcaFactura(ventaId);
      setFacturaInfo((data?.factura || null) as FacturaInfo | null);
      setFacturaSnapshot(data?.snapshot || null);
    } catch (e: any) {
      const msg = e?.message || 'No se pudo cargar la factura';
      setFacturaInfo(null);
      setFacturaSnapshot(null);
      if (String(msg).toLowerCase().includes('factura no encontrada')) {
        setFacturaError(null);
      } else {
        setFacturaError(msg);
      }
    } finally {
      setFacturaLoading(false);
    }
  }

  async function emitirFactura() {
    if (!detalleVenta.venta || emitLoading) return;
    setFacturaError(null);
    setEmitLoading(true);
    try {
      const conceptoNum = Number(emitForm.concepto || 1);
      const body: any = {
        venta_id: detalleVenta.venta.id,
        concepto: conceptoNum,
      };
      if (emitForm.punto_venta_id) body.punto_venta_id = Number(emitForm.punto_venta_id);
      if (canOverrideComprobante && emitForm.tipo_comprobante) {
        body.tipo_comprobante = emitForm.tipo_comprobante;
      }
      if (conceptoNum !== 1) {
        body.fecha_serv_desde = emitForm.fecha_serv_desde;
        body.fecha_serv_hasta = emitForm.fecha_serv_hasta;
        body.fecha_vto_pago = emitForm.fecha_vto_pago;
      }
      await Api.arcaEmitirFactura(body);
      await loadFactura(detalleVenta.venta.id);
    } catch (e: any) {
      setFacturaError(e?.message || 'No se pudo emitir la factura');
    } finally {
      setEmitLoading(false);
    }
  }

  async function descargarFacturaPdf() {
    if (!detalleVenta.venta) return;
    try {
      const blob = await Api.arcaFacturaPdf(detalleVenta.venta.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${detalleVenta.venta.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setFacturaError(e?.message || 'No se pudo descargar la factura');
    }
  }

  async function abrirDetalleVenta(venta: Venta) {
    setDetalleVenta({
      abierto: true,
      venta,
      items: [],
      loading: true,
      error: null,
    });
    setFacturaInfo(null);
    setFacturaSnapshot(null);
    setFacturaError(null);
    try {
      const rows = await Api.ventaDetalle(venta.id);
      setDetalleVenta((prev) => ({
        ...prev,
        items: (rows || []) as VentaDetalleItem[],
        loading: false,
      }));
      await loadFactura(venta.id);
    } catch (e: any) {
      setDetalleVenta((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || 'No se pudo cargar el detalle de la venta',
      }));
    }
  }

  function cerrarDetalleVenta() {
    setDetalleVenta({
      abierto: false,
      venta: null,
      items: [],
      loading: false,
      error: null,
    });
    setFacturaInfo(null);
    setFacturaSnapshot(null);
    setFacturaError(null);
  }

  useEffect(() => {
    if (!detalleVenta.venta) return;
    const baseDate = new Date(detalleVenta.venta.fecha);
    const dateStr = Number.isNaN(baseDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : baseDate.toISOString().slice(0, 10);
    setEmitForm({
      punto_venta_id: '',
      tipo_comprobante: '',
      concepto: '1',
      fecha_serv_desde: dateStr,
      fecha_serv_hasta: dateStr,
      fecha_vto_pago: dateStr,
    });
  }, [detalleVenta.venta]);

  const abiertas = (ventas || []).filter(
    v =>
      !v.oculto &&
      v.estado_pago !== 'cancelado' &&
      (v.estado_entrega || 'pendiente') !== 'entregado',
  );
  const historial = (ventas || []).filter(
    v =>
      !v.oculto &&
      ((v.estado_entrega || 'pendiente') === 'entregado' || v.estado_pago === 'cancelado'),
  ).sort((a, b) => b.id - a.id);

  return (
    <div className="space-y-6">
      <ChartCard title="Ventas" right={
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 rounded bg-primary-500/20 border border-primary-500/30 hover:bg-primary-500/30 text-primary-200 text-sm">{open ? 'Cancelar' : 'Nueva venta'}</button>
      }>
        {open && (
          <div className="mb-4 p-3 app-panel space-y-3">
            {error && <div className="text-rose-300 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Cliente</div>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')} className="w-full input-modern text-sm">
                  <option value="">Seleccionar</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Fecha</div>
                <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full input-modern text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-slate-400 mb-1">Descuento</div>
                  <input type="number" step="0.01" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))} className="w-full input-modern text-sm" />
                </label>
                <label className="text-sm">
                  <div className="text-slate-400 mb-1">Impuestos</div>
                  <input type="number" step="0.01" value={impuestos} onChange={(e) => setImpuestos(Number(e.target.value))} className="w-full input-modern text-sm" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Deposito</div>
                <select
                  value={depositoId}
                  onChange={(e) => setDepositoId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full input-modern text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {depositos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} {d.codigo ? `(${d.codigo})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  className="rounded border-white/20"
                  checked={esReserva}
                  onChange={(e) => setEsReserva(e.target.checked)}
                />
                <span className="text-slate-300">
                  Reserva (permitir sin stock)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm md:col-span-2">
                <div className="text-slate-400 mb-1">Codigo de referido</div>
                <div className="flex gap-2">
                  <input
                    value={referidoCodigo}
                    onChange={(e) => setReferidoCodigo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        validarReferido();
                      }
                    }}
                    className="w-full input-modern text-sm"
                    placeholder="Ej: REF-ABC123"
                  />
                  <button
                    type="button"
                    onClick={validarReferido}
                    className="px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-xs text-slate-200"
                    disabled={referidoLoading}
                  >
                    {referidoLoading ? 'Validando...' : 'Validar'}
                  </button>
                </div>
                {referidoInfo && (
                  <div className="mt-1 text-xs text-emerald-200">
                    {referidoInfo.alianza_nombre || 'Alianza'} - descuento ${Number(referidoInfo.descuento_aplicado || 0).toFixed(2)}
                  </div>
                )}
                {referidoError && (
                  <div className="mt-1 text-xs text-rose-300">{referidoError}</div>
                )}
              </label>
            </div>

            <div className="mt-2 text-sm">
              <div className="flex items-center gap-4 text-slate-300">
                <label className="flex items-center gap-2">
                  <span className="text-slate-400">Tipo de Precio:</span>
                    <select
                      value={priceType}
                      onChange={(e) => setPriceType(e.target.value as 'local' | 'distribuidor' | 'final')}
                      className="bg-white/10 border border-white/10 rounded px-2 py-1 text-xs"
                    >
                      <option value="local">{priceLabels.local}</option>
                      <option value="distribuidor">{priceLabels.distribuidor}</option>
                      <option value="final">{priceLabels.final}</option>
                    </select>
                  </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-2 px-2">Producto</th>
                    <th className="py-2 px-2">Precio</th>
                    <th className="py-2 px-2">Cantidad</th>
                    <th className="py-2 px-2">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {items.map((it, idx) => {
                    const prod = productosById.get(Number(it.producto_id));
                    const autoPrice = calculatePriceByType(prod);
                    const qty = Number(it.cantidad || 0);
                    const effectivePrice = Number(it.precio_unitario || 0);

                    return (
                      <tr key={idx} className="border-t border-white/10">
                        <td className="py-2 px-2">
                          <select
                            value={it.producto_id}
                            onChange={(e) => {
                              const newProdId = e.target.value ? Number(e.target.value) : '';
                              const newProd =
                                newProdId === '' ? undefined : productosById.get(newProdId);
                              const newAutoPrice = calculatePriceByType(newProd);
                              updateItem(idx, {
                                producto_id: newProdId,
                                precio_unitario: newAutoPrice > 0 ? String(newAutoPrice) : '',
                              });
                            }}
                            className="bg-white/10 border border-white/10 rounded px-2 py-1"
                          >
                            <option value="">Seleccionar</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.name} {p.category_name ? `(${p.category_name})` : ''}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={autoPrice > 0 ? autoPrice.toFixed(2) : 'Ingrese precio'}
                            value={it.precio_unitario}
                            onChange={(e) => updateItem(idx, { precio_unitario: e.target.value })}
                            className="w-28 bg-white/10 border border-white/10 rounded px-2 py-1"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={1} value={it.cantidad} onChange={(e) => updateItem(idx, { cantidad: e.target.value })} className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1" />
                        </td>
                        <td className="py-2 px-2">${(effectivePrice * qty).toFixed(2)}</td>
                        <td className="py-2 px-2">
                          <button onClick={() => removeItemRow(idx)} className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-200 text-xs">Quitar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2">
                <button onClick={addItemRow} className="px-2 py-1 rounded bg-white/10 border border-white/10 hover:bg-white/15 text-slate-200 text-xs">+ Agregar Ã­tem</button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-6 text-sm">
              <div className="text-slate-300">Subtotal: <span className="font-semibold text-slate-100">${subtotal.toFixed(2)}</span></div>
              {referidoDescuento > 0 && (
                <div className="text-slate-300">
                  Desc. referido: <span className="font-semibold text-slate-100">-${referidoDescuento.toFixed(2)}</span>
                </div>
              )}
              <div className="text-slate-300">Neto: <span className="font-semibold text-slate-100">${neto.toFixed(2)}</span></div>
              <button onClick={submitVenta} className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-sm">Crear venta</button>
            </div>
          </div>
        )}

        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Neto</th>
                <th className="py-2 px-2">Reserva</th>
                <th className="py-2 px-2">Entrega</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : abiertas).map((v) => (
              <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{v.id}</td>
                <td className="py-2 px-2">{v.cliente_nombre}</td>
                <td className="py-2 px-2">{new Date(v.fecha).toLocaleString()}</td>
                <td className="py-2 px-2">${Number(v.total || 0).toFixed(2)}</td>
                <td className="py-2 px-2">${Number(v.neto || 0).toFixed(2)}</td>
                <td className="py-2 px-2">
                  {v.es_reserva ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs border bg-amber-500/20 border-amber-500/40 text-amber-200">
                      Reserva
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="py-2 px-2">{v.estado_entrega || 'pendiente'}</td>
                <td className="py-2 px-2 space-x-2">
                  <button
                    onClick={() => abrirDetalleVenta(v)}
                    className="px-2 py-1 rounded bg-slate-500/20 border border-slate-500/30 hover:bg-slate-500/30 text-slate-200 text-xs"
                  >
                    Detalle
                  </button>
                  {canEntregarVenta(v) && (
                    <button
                      onClick={async () => {
                        try {
                          await Api.entregarVenta(v.id);
                          await loadAll();
                        } catch (e: any) {
                          alert(e?.message || 'No se pudo marcar entregado');
                        }
                      }}
                      className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-xs"
                    >
                      Marcar entregado
                    </button>
                  )}
                  {canEntregarVenta(v) && (
                    <button
                      onClick={() => cancelarVenta(v)}
                      className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-200 text-xs"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={() => abrirRemitoModal(v)}
                    className="px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-slate-200 text-xs"
                  >
                    Remito PDF
                  </button>
                  {(v.estado_entrega || 'pendiente') === 'entregado' && (
                    <button
                      onClick={() => ocultarVenta(v)}
                      className="px-2 py-1 rounded bg-slate-700/60 border border-slate-500/60 hover:bg-slate-600/80 text-slate-100 text-xs"
                    >
                      Ocultar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && abiertas.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={8}>Sin ventas</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>

      {/* Historial de ventas entregadas o canceladas */}
      <ChartCard title="Historial" right={null}>
        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Neto</th>
                <th className="py-2 px-2">Reserva</th>
                <th className="py-2 px-2">Entrega</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : historial).map((v) => (
              <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{v.id}</td>
                <td className="py-2 px-2">{v.cliente_nombre}</td>
                <td className="py-2 px-2">{new Date(v.fecha).toLocaleString()}</td>
                <td className="py-2 px-2">${Number(v.total || 0).toFixed(2)}</td>
                <td className="py-2 px-2">${Number(v.neto || 0).toFixed(2)}</td>
                <td className="py-2 px-2">
                  {v.es_reserva ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs border bg-amber-500/20 border-amber-500/40 text-amber-200">
                      Reserva
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="py-2 px-2">{v.estado_entrega || 'pendiente'}</td>
                <td className="py-2 px-2 space-x-2">
                  <button
                    onClick={() => abrirDetalleVenta(v)}
                    className="px-2 py-1 rounded bg-slate-500/20 border border-slate-500/30 hover:bg-slate-500/30 text-slate-200 text-xs"
                  >
                    Detalle
                  </button>
                  {v.estado_pago !== 'cancelado' && (
                    <button
                      onClick={() => abrirRemitoModal(v)}
                      className="px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-slate-200 text-xs"
                    >
                      Remito PDF
                    </button>
                  )}
                  <button
                    onClick={() => ocultarVenta(v)}
                    className="px-2 py-1 rounded bg-slate-700/60 border border-slate-500/60 hover:bg-slate-600/80 text-slate-100 text-xs"
                  >
                    Ocultar
                  </button>
                </td>
              </tr>
            ))}
            {!loading && historial.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={8}>Sin historial</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>

      {detalleVenta.abierto && detalleVenta.venta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="app-card w-full max-w-3xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Detalle de venta</div>
                <div className="text-base text-slate-100">
                  Venta #{detalleVenta.venta.id} - {detalleVenta.venta.cliente_nombre}
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                onClick={cerrarDetalleVenta}
                disabled={detalleVenta.loading}
              >
                Cerrar
              </button>
            </div>
            {detalleVenta.error && (
              <div className="text-xs text-rose-300">{detalleVenta.error}</div>
            )}
            {detalleVenta.loading ? (
              <div className="py-6 text-center text-slate-400">Cargando detalle...</div>
            ) : (
              <div className="overflow-x-auto text-xs md:text-sm max-h-[60vh]">
                <table className="min-w-full">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="py-1 pr-2">Producto</th>
                      <th className="py-1 pr-2">Cantidad</th>
                      <th className="py-1 pr-2">Precio</th>
                      <th className="py-1 pr-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {detalleVenta.items.map((it) => (
                      <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="py-1 pr-2">{it.producto_nombre}</td>
                        <td className="py-1 pr-2">{Number(it.cantidad || 0)}</td>
                        <td className="py-1 pr-2">
                          ${Number(it.precio_unitario || 0).toFixed(2)}
                        </td>
                        <td className="py-1 pr-2">
                          ${Number(it.subtotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {!detalleVenta.items.length && (
                      <tr>
                        <td className="py-2 text-slate-400" colSpan={4}>
                          Sin items registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10">
                      <td className="py-2 pr-2 text-right text-slate-400" colSpan={3}>
                        Total
                      </td>
                      <td className="py-2 pr-2 text-slate-200">
                        ${totalDetalle.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="mt-4 p-3 app-panel space-y-3">
              <div className="text-sm font-semibold text-slate-200">Factura ARCA</div>
              {facturaLoading && <div className="text-xs text-slate-400">Cargando factura...</div>}
              {facturaError && <div className="text-xs text-rose-300">{facturaError}</div>}
              {!facturaLoading && !facturaInfo && (
                <div className="text-xs text-slate-400">Sin factura emitida.</div>
              )}
              {facturaInfo && (
                <div className="text-xs text-slate-200 space-y-1">
                  <div>Estado: <span className="text-slate-100">{facturaInfo.estado}</span></div>
                  <div>Numero: <span className="text-slate-100">{facturaInfo.numero_factura || '-'}</span></div>
                  <div>CAE: <span className="text-slate-100">{facturaInfo.cae || '-'}</span></div>
                  <div>Vto CAE: <span className="text-slate-100">{facturaInfo.cae_vto || '-'}</span></div>
                  {facturaInfo.error && (
                    <div className="text-rose-300">Error: {facturaInfo.error}</div>
                  )}
                </div>
              )}

              {facturaInfo?.estado === 'emitida' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={descargarFacturaPdf}
                    className="px-3 py-1.5 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-slate-200 text-xs"
                  >
                    Descargar factura PDF
                  </button>
                </div>
              )}

              {(!facturaInfo || facturaInfo.estado !== 'emitida') && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <label className="block">
                      <div className="text-slate-400 mb-1">Punto de venta</div>
                      <select
                        className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-100"
                        value={emitForm.punto_venta_id}
                        onChange={(e) => setEmitForm((prev) => ({ ...prev, punto_venta_id: e.target.value }))}
                      >
                        <option value="">Auto (por deposito)</option>
                        {puntosVentaArca.map((pv) => (
                          <option key={pv.id} value={pv.id}>
                            {String(pv.punto_venta).padStart(4, '0')} {pv.nombre ? `- ${pv.nombre}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-slate-400 mb-1">Concepto</div>
                      <select
                        className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-100"
                        value={emitForm.concepto}
                        onChange={(e) => setEmitForm((prev) => ({ ...prev, concepto: e.target.value }))}
                      >
                        <option value="1">Productos</option>
                        <option value="2">Servicios</option>
                        <option value="3">Productos y servicios</option>
                      </select>
                    </label>
                    {canOverrideComprobante && (
                      <label className="block">
                        <div className="text-slate-400 mb-1">Tipo comprobante</div>
                        <select
                          className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-100"
                          value={emitForm.tipo_comprobante}
                          onChange={(e) => setEmitForm((prev) => ({ ...prev, tipo_comprobante: e.target.value }))}
                        >
                          <option value="">Automatico</option>
                          <option value="A">Factura A</option>
                          <option value="B">Factura B</option>
                          <option value="C">Factura C</option>
                        </select>
                      </label>
                    )}
                  </div>

                  {emitForm.concepto !== '1' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <label className="block">
                        <div className="text-slate-400 mb-1">Servicio desde</div>
                        <input
                          type="date"
                          className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-100"
                          value={emitForm.fecha_serv_desde}
                          onChange={(e) => setEmitForm((prev) => ({ ...prev, fecha_serv_desde: e.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <div className="text-slate-400 mb-1">Servicio hasta</div>
                        <input
                          type="date"
                          className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-100"
                          value={emitForm.fecha_serv_hasta}
                          onChange={(e) => setEmitForm((prev) => ({ ...prev, fecha_serv_hasta: e.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <div className="text-slate-400 mb-1">Vto pago</div>
                        <input
                          type="date"
                          className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-slate-100"
                          value={emitForm.fecha_vto_pago}
                          onChange={(e) => setEmitForm((prev) => ({ ...prev, fecha_vto_pago: e.target.value }))}
                        />
                      </label>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={emitirFactura}
                    className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-xs"
                    disabled={emitLoading}
                  >
                    {emitLoading ? 'Emitiendo...' : facturaInfo?.estado === 'error' ? 'Reintentar emision' : 'Emitir factura'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {remitoModal.abierto && remitoModal.venta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="app-card w-full max-w-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">Remito de entrega</div>
                <div className="text-base text-slate-100">
                  Venta #{remitoModal.venta.id} - {remitoModal.venta.cliente_nombre}
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                onClick={cerrarRemitoModal}
                disabled={remitoModal.loading}
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">Observaciones (opcional)</label>
              <textarea
                className="input-modern w-full text-sm min-h-[100px]"
                placeholder="Ej: Pago mitad efectivo, mitad transferencia."
                value={remitoModal.observaciones}
                onChange={(e) =>
                  setRemitoModal((prev) => ({ ...prev, observaciones: e.target.value }))
                }
              />
            </div>

            {remitoModal.error && (
              <div className="text-xs text-rose-300">{remitoModal.error}</div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="input-modern text-sm"
                onClick={cerrarRemitoModal}
                disabled={remitoModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="h-9 rounded-lg bg-emerald-600 text-white px-4 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={descargarRemitoPdf}
                disabled={remitoModal.loading}
              >
                {remitoModal.loading ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

