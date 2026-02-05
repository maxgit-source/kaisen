import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Api } from '../lib/api';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Cliente = {
  id: number;
  nombre: string;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  cuit_cuil?: string | null;
  tipo_doc?: string | null;
  nro_doc?: string | null;
  condicion_iva?: string | null;
  domicilio_fiscal?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  codigo_postal?: string | null;
  zona_id?: number | null;
   tipo_cliente?: 'minorista' | 'mayorista' | 'distribuidor' | null;
   segmento?: string | null;
   tags?: string | null;
  estado: 'activo' | 'inactivo';
};

type Zona = {
  id: number;
  nombre: string;
  color_hex?: string | null;
  activo?: boolean;
};

type VentaCliente = {
  id: number;
  fecha: string;
  neto?: number;
  total?: number;
  estado_pago: string;
  saldo_pendiente?: number;
};

type CrmOportunidad = {
  id: number;
  titulo: string;
  fase: string;
  valor_estimado?: number;
  probabilidad?: number;
  fecha_cierre_estimada?: string;
};

type CrmActividad = {
  id: number;
  tipo: string;
  asunto: string;
  fecha_hora?: string;
  estado: string;
};

type DeudaInicial = {
  id: number;
  cliente_id: number;
  monto: number;
  fecha: string;
  descripcion?: string | null;
};

type DeudaInicialPago = {
  id: number;
  cliente_id: number;
  monto: number;
  fecha: string;
  descripcion?: string | null;
};

type MetodoPago = {
  id: number;
  nombre: string;
  moneda?: string | null;
  activo?: boolean;
  orden?: number;
};

type PagoMetodoForm = {
  metodo_id: string;
  monto: string;
  moneda?: string | null;
};

type HistorialPago = {
  id: number;
  tipo: 'pago_venta' | 'pago_cuenta' | 'pago_deuda_inicial' | 'entrega_venta';
  venta_id?: number | null;
  monto?: number | null;
  fecha: string;
  detalle?: string | null;
};

type HistorialCuentaItem = {
  id: string;
  fecha?: string | null;
  tipo: 'pago' | 'compra' | 'entrega';
  monto?: number | null;
  detalle?: string | null;
};

type ClienteAcceso = {
  cliente_id: number;
  email?: string | null;
  has_access: boolean;
  password_set_at?: string | null;
  last_login_at?: string | null;
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [deudas, setDeudas] = useState<Record<number, number>>({});
  const [deudaUmbralRojo, setDeudaUmbralRojo] = useState<number>(1000000);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [detalleVentas, setDetalleVentas] = useState<VentaCliente[]>([]);
  const [ranking, setRanking] = useState<{ cliente_id: number; total: number }[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [crmOpps, setCrmOpps] = useState<CrmOportunidad[]>([]);
  const [crmActs, setCrmActs] = useState<CrmActividad[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [clienteAcceso, setClienteAcceso] = useState<ClienteAcceso | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSaving, setAccessSaving] = useState(false);
  const [deudasIniciales, setDeudasIniciales] = useState<DeudaInicial[]>([]);
  const [pagosDeudaInicial, setPagosDeudaInicial] = useState<DeudaInicialPago[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [metodosPagoLoading, setMetodosPagoLoading] = useState(false);
  const [metodosPagoError, setMetodosPagoError] = useState<string | null>(null);
  const [pagoMetodos, setPagoMetodos] = useState<PagoMetodoForm[]>([
    { metodo_id: '', monto: '', moneda: '' },
  ]);
  const [historialPagos, setHistorialPagos] = useState<HistorialPago[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialDeleting, setHistorialDeleting] = useState(false);
  const [deudaAnteriorForm, setDeudaAnteriorForm] = useState({
    tiene: false,
    monto: '',
  });
  const [pagoDeudaForm, setPagoDeudaForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    venta_id: '',
  });
  const [pagoDeudaSaving, setPagoDeudaSaving] = useState(false);
  const [pagoDeudaError, setPagoDeudaError] = useState<string | null>(null);
  const [padronLoading, setPadronLoading] = useState(false);
  const [padronError, setPadronError] = useState<string | null>(null);
  const [padronOverwrite, setPadronOverwrite] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    direccion: '',
    cuit_cuil: '',
    tipo_doc: '',
    nro_doc: '',
    condicion_iva: '',
    domicilio_fiscal: '',
    provincia: '',
    localidad: '',
    codigo_postal: '',
    zona_id: '',
    tipo_cliente: 'minorista',
    segmento: '',
    tags: '',
  });
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const CLIENTES_LIMIT = 200;
  const HISTORIAL_LIMIT = 200;
  const searchInitialized = useRef(false);
  const canSubmit = useMemo(() => Boolean(form.nombre), [form]);

  async function loadBase() {
    setError(null);
    try {
      const [deudaRows, topRows, umbralRes, zonasRes] = await Promise.all([
        Api.deudas(),
        Api.topClientes(200).catch(() => []),
        Api.getDebtThreshold().catch(() => null),
        Api.zonas().catch(() => []),
      ]);
      const map: Record<number, number> = {};
      for (const d of deudaRows as any[]) {
        map[d.cliente_id] = Number(d.deuda_pendiente || 0);
      }
      setDeudas(map);
      const umbralVal =
        umbralRes && typeof (umbralRes as any).valor === 'number'
          ? Number((umbralRes as any).valor)
          : null;
      if (umbralVal != null && umbralVal > 0) {
        setDeudaUmbralRojo(umbralVal);
      }
      setZonas(Array.isArray(zonasRes) ? (zonasRes as Zona[]) : []);
      setRanking(
        (topRows || []).map((r: any) => ({
          cliente_id: Number(r.cliente_id),
          total: Number(r.total_comprado || 0),
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los clientes');
    }
  }

  async function loadClientes(query: string) {
    setLoading(true);
    setError(null);
    try {
      const qValue = query.trim();
      const clis = await Api.clientes({
        q: qValue ? qValue : undefined,
        limit: CLIENTES_LIMIT,
      });
      setClientes(clis as Cliente[]);
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los clientes');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    await Promise.all([loadBase(), loadClientes(q)]);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setMetodosPagoLoading(true);
      setMetodosPagoError(null);
      try {
        const rows = await Api.metodosPago();
        if (!active) return;
        setMetodosPago((rows || []) as MetodoPago[]);
      } catch (e: any) {
        if (!active) return;
        setMetodosPagoError(e?.message || 'No se pudieron cargar los metodos de pago');
        setMetodosPago([]);
      } finally {
        if (active) setMetodosPagoLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);


  useEffect(() => {
    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }
    const handle = window.setTimeout(() => {
      loadClientes(q);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q]);

  const resumenSeleccionado = useMemo(() => {
    if (!selectedCliente) {
      return {
        totalComprado: 0,
        ticketPromedio: 0,
        ultimaCompra: null as Date | null,
        deudaCorriente: 0,
        comprasCount: 0,
        frecuenciaPromedioDias: null as number | null,
        rankingPosicion: null as number | null,
        rankingTotal: ranking.length,
      };
    }
    const comprasCount = detalleVentas.length;
    let totalComprado = 0;
    let ultimaCompra: Date | null = null;
    for (const v of detalleVentas) {
      const monto = Number(v.neto ?? v.total ?? 0);
      totalComprado += monto;
      if (v.fecha) {
        const f = new Date(v.fecha);
        if (!Number.isNaN(f.getTime())) {
          if (!ultimaCompra || f > ultimaCompra) ultimaCompra = f;
        }
      }
    }
    const deudaCorriente = Number(selectedCliente ? deudas[selectedCliente.id] || 0 : 0);
    const ticketPromedio = comprasCount ? totalComprado / comprasCount : 0;

    // Frecuencia promedio entre compras (en días)
    let frecuenciaPromedioDias: number | null = null;
    if (comprasCount > 1) {
      const ordenadas = [...detalleVentas]
        .filter((v) => v.fecha)
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      if (ordenadas.length > 1) {
        let difTotal = 0;
        let pares = 0;
        for (let i = 1; i < ordenadas.length; i += 1) {
          const prev = new Date(ordenadas[i - 1].fecha);
          const curr = new Date(ordenadas[i].fecha);
          if (!Number.isNaN(prev.getTime()) && !Number.isNaN(curr.getTime())) {
            const diffMs = curr.getTime() - prev.getTime();
            difTotal += diffMs / (1000 * 60 * 60 * 24);
            pares += 1;
          }
        }
        if (pares > 0) frecuenciaPromedioDias = difTotal / pares;
      }
    }

    // Posición en ranking interno (si está en el top cargado)
    const idx = ranking.findIndex((r) => r.cliente_id === selectedCliente.id);
    const rankingPosicion = idx >= 0 ? idx + 1 : null;

    return {
      totalComprado,
      ticketPromedio,
      ultimaCompra,
      deudaCorriente,
      comprasCount,
      frecuenciaPromedioDias,
      rankingPosicion,
      rankingTotal: ranking.length,
    };
  }, [selectedCliente, detalleVentas, deudas, ranking]);

  const totalDeudaAnterior = useMemo(
    () =>
      deudasIniciales.reduce(
        (acc, d) => acc + (typeof d.monto === 'number' ? d.monto : Number(d.monto || 0)),
        0
      ),
    [deudasIniciales]
  );

  const totalPagosDeudaAnterior = useMemo(
    () =>
      pagosDeudaInicial.reduce(
        (acc, p) => acc + (typeof p.monto === 'number' ? p.monto : Number(p.monto || 0)),
        0
      ),
    [pagosDeudaInicial]
  );

  const saldoDeudaAnterior = useMemo(
    () => Math.max(totalDeudaAnterior - totalPagosDeudaAnterior, 0),
    [totalDeudaAnterior, totalPagosDeudaAnterior]
  );

  const ventasPendientes = useMemo(
    () =>
      detalleVentas.filter(
        (v) =>
          Number(v.saldo_pendiente ?? v.neto ?? v.total ?? 0) > 0 &&
          v.estado_pago !== 'cancelado'
      ),
    [detalleVentas]
  );

  function parseMonto(value: string) {
    const num = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  }

  const totalPagoMetodos = useMemo(
    () => pagoMetodos.reduce((acc, row) => acc + parseMonto(row.monto), 0),
    [pagoMetodos]
  );

  const canSubmitPago = useMemo(() => {
    return (
      metodosPago.length > 0 &&
      pagoMetodos.some(
        (row) => Number(row.metodo_id) > 0 && parseMonto(row.monto) > 0
      ) && !pagoDeudaSaving
    );
  }, [metodosPago.length, pagoMetodos, pagoDeudaSaving]);

  const historialCuenta = useMemo(() => {
    const items: HistorialCuentaItem[] = [];

    for (const v of detalleVentas) {
      if (v.estado_pago === 'cancelado') continue;
      const monto = Number(v.neto ?? v.total ?? 0);
      items.push({
        id: `venta-${v.id}`,
        fecha: v.fecha,
        tipo: 'compra',
        monto,
        detalle: `Venta #${v.id}`,
      });
    }

    for (const h of historialPagos) {
      if (h.tipo === 'entrega_venta') {
        items.push({
          id: `entrega-${h.id}`,
          fecha: h.fecha,
          tipo: 'entrega',
          detalle: h.detalle
            ? `Se llevo ${h.detalle}`
            : h.venta_id
              ? `Se llevo venta #${h.venta_id}`
              : 'Se llevo',
        });
        continue;
      }

      const detalle =
        h.tipo === 'pago_deuda_inicial'
          ? 'Deuda anterior'
          : h.venta_id
            ? `Venta #${h.venta_id}`
            : 'Cuenta corriente';
      items.push({
        id: `pago-${h.id}`,
        fecha: h.fecha,
        tipo: 'pago',
        monto: Number(h.monto ?? 0),
        detalle,
      });
    }

    items.sort((a, b) => {
      const aTime = a.fecha ? new Date(a.fecha).getTime() : 0;
      const bTime = b.fecha ? new Date(b.fecha).getTime() : 0;
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });

    return items;
  }, [detalleVentas, historialPagos]);

  async function cambiarEstado(cliente: Cliente, nuevoEstado: 'activo' | 'inactivo') {
    setError(null);
    try {
      await Api.actualizarCliente(cliente.id, {
        nombre: cliente.nombre,
        apellido: cliente.apellido || undefined,
        email: cliente.email || undefined,
        telefono: cliente.telefono || undefined,
        direccion: cliente.direccion || undefined,
        cuit_cuil: cliente.cuit_cuil || undefined,
        estado: nuevoEstado,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar el estado del cliente');
    }
  }

  async function eliminarCliente(cliente: Cliente) {
    if (
      !window.confirm(
        `Eliminar cliente ${cliente.nombre}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await Api.eliminarCliente(cliente.id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el cliente');
    }
  }

  async function verDetalleCliente(cliente: Cliente) {
    setSelectedCliente(cliente);
    setDetalleLoading(true);
    setDetalleError(null);
    setAccessError(null);
    setPagoDeudaError(null);
    try {
      setDeudasIniciales([]);
      setPagosDeudaInicial([]);
      setHistorialPagos([]);
      setHistorialError(null);
      const [ventas, opps, acts, deudasIni, pagosIni, acceso, historial] = await Promise.all([
        Api.ventas({ cliente_id: cliente.id, limit: 200 }),
        Api.oportunidades({ cliente_id: cliente.id, limit: 50 }),
        Api.actividades({ cliente_id: cliente.id, estado: 'pendiente', limit: 50 }),
        Api.clienteDeudasIniciales(cliente.id).catch(() => []),
        Api.clientePagosDeudaInicial(cliente.id).catch(() => []),
        Api.clienteAcceso(cliente.id).catch(() => null),
        Api.clienteHistorialPagos(cliente.id, { limit: HISTORIAL_LIMIT }).catch(() => []),
      ]);
      setDetalleVentas((ventas || []) as VentaCliente[]);
      setCrmOpps((opps || []) as CrmOportunidad[]);
      setCrmActs((acts || []) as CrmActividad[]);
      setDeudasIniciales((deudasIni || []) as DeudaInicial[]);
      setPagosDeudaInicial((pagosIni || []) as DeudaInicialPago[]);
      setClienteAcceso((acceso || null) as ClienteAcceso | null);
      setHistorialPagos((historial || []) as HistorialPago[]);
    } catch (e: any) {
      setDetalleError(e?.message || 'No se pudo cargar el detalle del cliente');
      setDetalleVentas([]);
      setCrmOpps([]);
      setCrmActs([]);
      setDeudasIniciales([]);
      setPagosDeudaInicial([]);
      setHistorialPagos([]);
      setHistorialError(null);
      setClienteAcceso(null);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function loadHistorialPagos() {
    if (!selectedCliente) return;
    setHistorialLoading(true);
    setHistorialError(null);
    try {
      const rows = await Api.clienteHistorialPagos(selectedCliente.id, {
        limit: HISTORIAL_LIMIT,
      });
      setHistorialPagos((rows || []) as HistorialPago[]);
    } catch (e: any) {
      setHistorialError(e?.message || 'No se pudo cargar el historial de pagos');
      setHistorialPagos([]);
    } finally {
      setHistorialLoading(false);
    }
  }

  async function abrirHistorialPagos() {
    if (!selectedCliente) {
      window.alert('Primero selecciona un cliente');
      return;
    }
    setShowHistorialModal(true);
    await loadHistorialPagos();
  }

  function updatePagoMetodo(index: number, changes: Partial<PagoMetodoForm>) {
    setPagoMetodos((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...changes } : row))
    );
  }

  function addPagoMetodoRow() {
    setPagoMetodos((prev) => [...prev, { metodo_id: '', monto: '', moneda: '' }]);
  }

  function removePagoMetodoRow(index: number) {
    setPagoMetodos((prev) => prev.filter((_, i) => i !== index));
  }

  async function registrarPagoDeuda() {
    if (!selectedCliente || pagoDeudaSaving) return;
    setPagoDeudaError(null);
    if (!metodosPago.length) {
      setPagoDeudaError('Configura al menos un metodo de pago en Configuracion');
      return;
    }
    const parsedRows = pagoMetodos.map((row) => {
      const metodoId = Number(row.metodo_id);
      const monto = parseMonto(row.monto);
      const metodo = metodosPago.find((m) => Number(m.id) === metodoId);
      return {
        metodo_id: metodoId,
        monto,
        moneda: (row.moneda || metodo?.moneda || '').toString().trim().toUpperCase(),
        rawMetodo: row.metodo_id,
        rawMonto: row.monto,
      };
    });
    const invalidRow = parsedRows.find(
      (row) =>
        (row.rawMetodo && (!row.metodo_id || row.metodo_id <= 0)) ||
        (row.rawMonto && row.monto <= 0) ||
        (row.metodo_id > 0 && row.monto <= 0)
    );
    if (invalidRow) {
      setPagoDeudaError('Completa los metodos y montos validos');
      return;
    }
    const metodosValidos = parsedRows.filter((row) => row.metodo_id > 0 && row.monto > 0);
    if (!metodosValidos.length) {
      setPagoDeudaError('Agrega al menos un metodo con monto');
      return;
    }
    const totalMonto = metodosValidos.reduce((acc, row) => acc + row.monto, 0);
    if (!Number.isFinite(totalMonto) || totalMonto <= 0) {
      setPagoDeudaError('El total del pago es invalido');
      return;
    }
    const ventaId = pagoDeudaForm.venta_id ? Number(pagoDeudaForm.venta_id) : null;
    if (ventasPendientes.length && (!ventaId || !Number.isInteger(ventaId))) {
      setPagoDeudaError('Selecciona una venta pendiente para registrar el pago');
      return;
    }
    setPagoDeudaSaving(true);
    try {
      const fecha = pagoDeudaForm.fecha || undefined;
      await Api.crearPago({
        cliente_id: selectedCliente.id,
        monto: totalMonto,
        fecha,
        venta_id: ventaId || undefined,
        metodos: metodosValidos.map((row) => ({
          metodo_id: row.metodo_id,
          monto: row.monto,
          moneda: row.moneda || undefined,
        })),
      });
      await verDetalleCliente(selectedCliente);
      await loadBase();
      if (showHistorialModal) {
        await loadHistorialPagos();
      }
      setPagoDeudaForm((prev) => ({ ...prev, venta_id: '' }));
      setPagoMetodos([{ metodo_id: '', monto: '', moneda: '' }]);
    } catch (e: any) {
      setPagoDeudaError(e?.message || 'No se pudo registrar el pago');
    } finally {
      setPagoDeudaSaving(false);
    }
  }

  async function eliminarPagoHistorial(item: HistorialPago) {
    if (!selectedCliente || historialDeleting) return;
    if (item.tipo === 'entrega_venta') return;
    if (!window.confirm('?Hubo un inconveniente con un pago?')) return;
    if (!window.confirm('?Deseas eliminarlo? Esta acci?n no se puede deshacer.')) return;
    setHistorialDeleting(true);
    try {
      if (item.tipo === 'pago_venta' || item.tipo === 'pago_cuenta') {
        await Api.eliminarPagoClienteVenta(selectedCliente.id, item.id);
      } else if (item.tipo === 'pago_deuda_inicial') {
        await Api.eliminarPagoClienteDeuda(selectedCliente.id, item.id);
      }
      await verDetalleCliente(selectedCliente);
      await loadBase();
      await loadHistorialPagos();
    } catch (e: any) {
      setHistorialError(e?.message || 'No se pudo eliminar el pago');
    } finally {
      setHistorialDeleting(false);
    }
  }

  function startEditCliente(cliente: Cliente) {
    setEditingCliente(cliente);
    setDeudaAnteriorForm({ tiene: false, monto: '' });
    setPadronError(null);
      setForm({
        nombre: cliente.nombre || '',
        apellido: cliente.apellido || '',
        email: cliente.email || '',
        telefono: cliente.telefono || '',
        direccion: cliente.direccion || '',
        cuit_cuil: cliente.cuit_cuil || '',
        tipo_doc: cliente.tipo_doc || '',
        nro_doc: cliente.nro_doc || '',
        condicion_iva: cliente.condicion_iva || '',
        domicilio_fiscal: cliente.domicilio_fiscal || '',
        provincia: cliente.provincia || '',
        localidad: cliente.localidad || '',
        codigo_postal: cliente.codigo_postal || '',
        zona_id: cliente.zona_id != null ? String(cliente.zona_id) : '',
        tipo_cliente: cliente.tipo_cliente || 'minorista',
        segmento: cliente.segmento || '',
        tags: cliente.tags || '',
      });
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  }

  async function completarDesdePadron() {
    setPadronError(null);
    if (!editingCliente) {
      setPadronError('Guarda el cliente antes de consultar padrón.');
      return;
    }
    if (!form.cuit_cuil) {
      setPadronError('Ingresa un CUIT/CUIL válido.');
      return;
    }
    setPadronLoading(true);
    try {
      const resp: any = await Api.arcaPadronCliente(editingCliente.id, {
        cuit: form.cuit_cuil,
        overwrite: padronOverwrite,
      });
      const data = resp?.data || {};
      setForm((prev) => ({
        ...prev,
        cuit_cuil: data.cuit || prev.cuit_cuil,
        tipo_doc: 'CUIT',
        nro_doc: data.cuit || prev.nro_doc,
        condicion_iva: data.condicion_iva || prev.condicion_iva,
        domicilio_fiscal: data.domicilio_fiscal || prev.domicilio_fiscal,
        provincia: data.provincia || prev.provincia,
        localidad: data.localidad || prev.localidad,
        codigo_postal: data.codigo_postal || prev.codigo_postal,
        nombre:
          padronOverwrite && (data.razon_social || data.nombre)
            ? data.razon_social || data.nombre
            : prev.nombre,
        apellido:
          padronOverwrite && data.apellido ? data.apellido : prev.apellido,
      }));
    } catch (e: any) {
      setPadronError(e?.message || 'No se pudo consultar padrón');
    } finally {
      setPadronLoading(false);
    }
  }

  async function crearActividadRapida() {
    if (!selectedCliente) return;
    const asunto = window.prompt(
      `Asunto de la actividad para ${selectedCliente.nombre}?`,
      ''
    );
    if (!asunto) return;
    const descripcion =
      window.prompt('Descripción (opcional)', '') || undefined;
    try {
      await Api.crearActividad({
        tipo: 'llamada',
        asunto: asunto.trim(),
        descripcion,
        fecha_hora: new Date().toISOString(),
        estado: 'pendiente',
        cliente_id: selectedCliente.id,
      });
      const acts = await Api.actividades({
        cliente_id: selectedCliente.id,
        estado: 'pendiente',
        limit: 50,
      });
      setCrmActs((acts || []) as CrmActividad[]);
    } catch (e: any) {
      // En esta vista usamos un fallback simple de alerta
      window.alert(
        e?.message || 'No se pudo crear la actividad rápida'
      );
    }
  }

  async function configurarAccesoCliente() {
    if (!selectedCliente || accessSaving) return;
    setAccessError(null);
    const promptMsg = clienteAcceso?.has_access
      ? 'Nueva contrasena para el cliente (dejar vacio para generar una).'
      : 'Contrasena inicial (dejar vacio para generar una).';
    const password = window.prompt(promptMsg, '');
    if (password === null) return;
    setAccessSaving(true);
    try {
      const resp: any = await Api.clienteSetPassword(
        selectedCliente.id,
        password ? { password } : {}
      );
      window.alert(`Contrasena de acceso para ${resp.email}: ${resp.password}`);
      const status = await Api.clienteAcceso(selectedCliente.id);
      setClienteAcceso(status as ClienteAcceso);
    } catch (e: any) {
      setAccessError(e?.message || 'No se pudo configurar el acceso del cliente');
    } finally {
      setAccessSaving(false);
    }
  }


    return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Clientes
      </h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canSubmit) return;
            setError(null);
            if (!editingCliente && deudaAnteriorForm.tiene) {
              const montoNum = Number(deudaAnteriorForm.monto.replace(',', '.'));
              if (!Number.isFinite(montoNum) || montoNum <= 0) {
                setError('Ingresa un monto válido para la deuda anterior');
                return;
              }
            }
            const payload = {
              nombre: form.nombre,
              apellido: form.apellido || undefined,
              email: form.email || undefined,
              telefono: form.telefono || undefined,
              direccion: form.direccion || undefined,
              cuit_cuil: form.cuit_cuil || undefined,
              tipo_doc: form.tipo_doc || undefined,
              nro_doc: form.nro_doc || undefined,
              condicion_iva: form.condicion_iva || undefined,
                domicilio_fiscal: form.domicilio_fiscal || undefined,
                provincia: form.provincia || undefined,
                localidad: form.localidad || undefined,
                codigo_postal: form.codigo_postal || undefined,
                zona_id: form.zona_id ? Number(form.zona_id) : undefined,
                tipo_cliente: form.tipo_cliente || undefined,
                segmento: form.segmento || undefined,
                tags: form.tags || undefined,
              estado: editingCliente?.estado || undefined,
            };
            try {
              if (editingCliente) {
                await Api.actualizarCliente(editingCliente.id, payload);
              } else {
                const created: any = await Api.crearCliente(payload);
                const createdId = Number(created?.id);
                if (deudaAnteriorForm.tiene && Number.isFinite(createdId) && createdId > 0) {
                  const montoNum = Number(deudaAnteriorForm.monto.replace(',', '.'));
                  try {
                    await Api.crearDeudaInicialCliente(createdId, {
                      monto: montoNum,
                    });
                  } catch (err: any) {
                    setError(
                      err?.message ||
                        'Cliente creado, pero no se pudo registrar la deuda anterior'
                    );
                  }
                }
              }
              setForm({
                nombre: '',
                apellido: '',
                email: '',
                telefono: '',
                direccion: '',
                cuit_cuil: '',
                tipo_doc: '',
                nro_doc: '',
                condicion_iva: '',
                domicilio_fiscal: '',
                provincia: '',
                localidad: '',
                codigo_postal: '',
                zona_id: '',
                tipo_cliente: 'minorista',
                segmento: '',
                tags: '',
              });
              setDeudaAnteriorForm({ tiene: false, monto: '' });
              setEditingCliente(null);
              await load();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : editingCliente
                  ? 'No se pudo actualizar el cliente'
                  : 'No se pudo crear el cliente'
              );
            }
          }}
          className="grid grid-cols-1 md:grid-cols-6 gap-2"
        >
          {error && (
            <div className="md:col-span-6">
              <Alert kind="error" message={error} />
            </div>
          )}
          <input
            className="input-modern text-sm"
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, nombre: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Apellido"
            value={form.apellido}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, apellido: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Teléfono"
            value={form.telefono}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, telefono: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Dirección"
            value={form.direccion}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, direccion: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="CUIT/CUIL"
            value={form.cuit_cuil}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, cuit_cuil: e.target.value }))
            }
          />
          <div className="md:col-span-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={completarDesdePadron}
              className="px-3 py-1.5 rounded bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-200 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!editingCliente || padronLoading}
            >
              {padronLoading ? 'Consultando padrón...' : 'Completar desde padrón'}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="rounded border-white/20"
                checked={padronOverwrite}
                onChange={(e) => setPadronOverwrite(e.target.checked)}
              />
              Sobrescribir nombre/apellido
            </label>
            {padronError && <span className="text-xs text-rose-300">{padronError}</span>}
          </div>
          <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              className="input-modern text-sm"
              value={form.tipo_doc}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tipo_doc: e.target.value }))
              }
            >
              <option value="">Tipo documento</option>
              <option value="CUIT">CUIT</option>
              <option value="CUIL">CUIL</option>
              <option value="DNI">DNI</option>
              <option value="CONSUMIDOR_FINAL">Consumidor final</option>
            </select>
            <input
              className="input-modern text-sm"
              placeholder="Nº documento"
              value={form.nro_doc}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nro_doc: e.target.value }))
              }
            />
            <select
              className="input-modern text-sm"
              value={form.condicion_iva}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, condicion_iva: e.target.value }))
              }
            >
              <option value="">Condición IVA</option>
              <option value="responsable_inscripto">Responsable inscripto</option>
              <option value="monotributo">Monotributo</option>
              <option value="consumidor_final">Consumidor final</option>
              <option value="exento">Exento</option>
              <option value="no_categorizado">No categorizado</option>
            </select>
            <input
              className="input-modern text-sm md:col-span-2"
              placeholder="Domicilio fiscal"
              value={form.domicilio_fiscal}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, domicilio_fiscal: e.target.value }))
              }
            />
            <input
              className="input-modern text-sm"
              placeholder="Provincia"
              value={form.provincia}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, provincia: e.target.value }))
              }
            />
            <input
              className="input-modern text-sm"
              placeholder="Localidad"
              value={form.localidad}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, localidad: e.target.value }))
              }
            />
            <input
              className="input-modern text-sm"
              placeholder="Código postal"
              value={form.codigo_postal}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, codigo_postal: e.target.value }))
              }
            />
          </div>
          <select
            className="input-modern text-sm"
            value={form.zona_id}
            onChange={(e) => setForm((prev) => ({ ...prev, zona_id: e.target.value }))}
          >
            <option value="">Zona</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
          <select
            className="input-modern text-sm"
            value={form.tipo_cliente}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tipo_cliente: e.target.value as any }))
            }
          >
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
            <option value="distribuidor">Distribuidor</option>
          </select>
          <input
            className="input-modern text-sm"
            placeholder="Segmento / rubro"
            value={form.segmento}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, segmento: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Tags (ej: VIP, Moroso)"
            value={form.tags}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tags: e.target.value }))
            }
          />
          {!editingCliente && (
            <>
              <label className="md:col-span-6 flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="accent-slate-200"
                  checked={deudaAnteriorForm.tiene}
                  onChange={(e) =>
                    setDeudaAnteriorForm((prev) => ({
                      ...prev,
                      tiene: e.target.checked,
                    }))
                  }
                />
                ¿Tiene deuda anterior?
              </label>
              {deudaAnteriorForm.tiene && (
                <input
                  className="input-modern text-sm md:col-span-2"
                  placeholder="Monto deuda anterior"
                  type="number"
                  min="0"
                  step="0.01"
                  value={deudaAnteriorForm.monto}
                  onChange={(e) =>
                    setDeudaAnteriorForm((prev) => ({
                      ...prev,
                      monto: e.target.value,
                    }))
                  }
                />
              )}
            </>
          )}
          <div className="md:col-span-6 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {editingCliente ? 'Guardar cambios' : 'Registrar cliente'}
            </Button>
            {editingCliente && (
              <button
                type="button"
                className="h-11 rounded-lg bg-white/5 border border-white/10 text-slate-200 px-4 text-sm"
                onClick={() => {
                  setEditingCliente(null);
                  setForm({
                    nombre: '',
                    apellido: '',
                    email: '',
                    telefono: '',
                    direccion: '',
                    cuit_cuil: '',
                    tipo_doc: '',
                    nro_doc: '',
                    condicion_iva: '',
                    domicilio_fiscal: '',
                    provincia: '',
                    localidad: '',
                    codigo_postal: '',
                    zona_id: '',
                    tipo_cliente: 'minorista',
                    segmento: '',
                    tags: '',
                  });
                  setDeudaAnteriorForm({ tiene: false, monto: '' });
                }}
              >
                Cancelar edicion
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="input-modern w-full pl-9"
              placeholder="Buscar por nombre o apellido"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
            />
          </div>
          {q ? (
            <button
              type="button"
              className="h-10 rounded-lg bg-white/5 border border-white/10 text-slate-200 px-3 text-xs"
              onClick={() => setQ('')}
            >
              Limpiar
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Deuda corriente</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {clientes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2">
                      {c.nombre} {c.apellido}
                    </td>
                    <td className="py-2">{c.email || '-'}</td>
                    <td className="py-2">
                      {(() => {
                        const deuda = Number(deudas[c.id] || 0);
                        const deudaClass =
                          deuda <= 0
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                            : deuda < deudaUmbralRojo
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                              : 'bg-rose-500/20 border-rose-500/40 text-rose-200';
                        return (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${deudaClass}`}
                          >
                            ${deuda.toFixed(2)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                          c.estado === 'activo'
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-500/20 border-slate-500/40 text-slate-200'
                        }`}
                      >
                        {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-2 space-x-2">
                      <button
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-xs"
                        onClick={() => verDetalleCliente(c)}
                      >
                        Ver detalle
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs"
                        onClick={() => startEditCliente(c)}
                      >
                        Editar
                      </button>
                      {c.estado === 'activo' ? (
                        <button
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs"
                          onClick={() => cambiarEstado(c, 'inactivo')}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <>
                          <button
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-xs"
                            onClick={() => cambiarEstado(c, 'activo')}
                          >
                            Activar
                          </button>
                          <button
                            className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs"
                            onClick={() => eliminarCliente(c)}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && !clientes.length && (
                  <tr>
                    <td className="py-6 text-center text-slate-400" colSpan={5}>
                      {q ? 'Sin resultados para la busqueda' : 'Sin clientes registrados'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {selectedCliente && (
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Detalle de cliente</h3>
              <p className="text-sm text-slate-400">
                {selectedCliente.nombre} {selectedCliente.apellido || ''} ·{' '}
                {selectedCliente.email || '-'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-xs"
                onClick={abrirHistorialPagos}
              >
                Historial pagos y entregas
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/40 text-slate-200 text-xs"
                onClick={() => {
                  setSelectedCliente(null);
                  setDetalleVentas([]);
                  setDetalleError(null);
                  setCrmOpps([]);
                  setCrmActs([]);
                  setClienteAcceso(null);
                  setAccessError(null);
                  setShowHistorialModal(false);
                  setHistorialPagos([]);
                  setHistorialError(null);
                  setPagoDeudaForm({
                    fecha: new Date().toISOString().slice(0, 10),
                    venta_id: '',
                  });
                  setPagoMetodos([{ metodo_id: '', monto: '', moneda: '' }]);
                  setPagoDeudaError(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
          {detalleError && (
            <div className="mb-3">
              <Alert kind="error" message={detalleError} />
            </div>
          )}
          {detalleLoading ? (
            <div className="py-6 text-center text-slate-500">
              Cargando detalle de cliente...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase">Datos</div>
                  <div>
                    Teléfono:{' '}
                    <span className="text-slate-200">
                      {selectedCliente.telefono || '-'}
                    </span>
                  </div>
                  <div>
                    Dirección:{' '}
                    <span className="text-slate-200">
                      {selectedCliente.direccion || '-'}
                    </span>
                  </div>
                  <div>
                    CUIT/CUIL:{' '}
                    <span className="text-slate-200">
                      {selectedCliente.cuit_cuil || '-'}
                    </span>
                  </div>
                  {accessError && (
                    <div className="text-xs text-rose-300">{accessError}</div>
                  )}
                  <div>
                    Acceso cliente:{' '}
                    <span className="text-slate-200">
                      {clienteAcceso?.has_access ? 'Activo' : 'Sin acceso'}
                    </span>
                  </div>
                  <div>
                    Email acceso:{' '}
                    <span className="text-slate-200">
                      {clienteAcceso?.email || selectedCliente.email || '-'}
                    </span>
                  </div>
                  {clienteAcceso?.last_login_at && (
                    <div className="text-xs text-slate-400">
                      Ultimo ingreso:{' '}
                      {new Date(clienteAcceso.last_login_at).toLocaleString()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={configurarAccesoCliente}
                    className="mt-2 px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={accessSaving}
                  >
                    {accessSaving
                      ? 'Guardando...'
                      : clienteAcceso?.has_access
                      ? 'Resetear contrasena'
                      : 'Crear contrasena'}
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase">Resumen</div>
                  <div>
                    Total comprado:{' '}
                    <span className="text-slate-200">
                      ${resumenSeleccionado.totalComprado.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    Ticket promedio:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.comprasCount
                        ? `$${resumenSeleccionado.ticketPromedio.toFixed(2)}`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    Compras realizadas:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.comprasCount}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 uppercase">Situación</div>
                  <div>
                    Deuda corriente:{' '}
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                        resumenSeleccionado.deudaCorriente <= 0
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                          : resumenSeleccionado.deudaCorriente < deudaUmbralRojo
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                            : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      ${resumenSeleccionado.deudaCorriente.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    Última compra:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.ultimaCompra
                        ? resumenSeleccionado.ultimaCompra.toLocaleString()
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">
                    Cuenta corriente
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs md:text-sm">
                      <thead className="text-left text-slate-400">
                        <tr>
                          <th className="py-1 pr-2">Fecha</th>
                          <th className="py-1 pr-2">Movimiento</th>
                          <th className="py-1 pr-2">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-200">
                        {historialCuenta.map((item) => {
                          const montoTexto =
                            typeof item.monto === 'number'
                              ? item.monto.toFixed(2)
                              : null;
                          const movimiento =
                            item.tipo === 'pago'
                              ? `Pago $${montoTexto ?? '0.00'}`
                              : item.tipo === 'compra'
                                ? `Compro $${montoTexto ?? '0.00'}`
                                : 'Se llevo';
                          return (
                          <tr
                            key={item.id}
                            className="border-t border-white/10 hover:bg-white/5"
                          >
                            <td className="py-1 pr-2">
                              {item.fecha ? new Date(item.fecha).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-1 pr-2">{movimiento}</td>
                            <td className="py-1 pr-2">{item.detalle || '-'}</td>
                          </tr>
                          );
                        })}
                        {!historialCuenta.length && (
                          <tr>
                            <td className="py-2 text-slate-400" colSpan={3}>
                              Sin movimientos registrados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">
                    Pago cuenta corriente
                  </h4>
                  {pagoDeudaError && (
                    <div className="text-xs text-rose-300 mb-2">{pagoDeudaError}</div>
                  )}
                  {!ventasPendientes.length && saldoDeudaAnterior <= 0 ? (
                    <div className="text-sm text-slate-400">
                      No hay deuda pendiente para registrar pagos.
                    </div>
                  ) : (
                    <form
                      className="space-y-3 text-sm"
                      onSubmit={(e) => {
                        e.preventDefault();
                        registrarPagoDeuda();
                      }}
                    >
                      <label className="block">
                        <div className="text-slate-300 mb-1">Venta pendiente</div>
                        <select
                          className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                          value={pagoDeudaForm.venta_id}
                          onChange={(e) =>
                            setPagoDeudaForm((prev) => ({
                              ...prev,
                              venta_id: e.target.value,
                            }))
                          }
                          disabled={pagoDeudaSaving}
                        >
                          <option value="">Cuenta corriente</option>
                          {ventasPendientes.map((v) => (
                            <option key={v.id} value={v.id}>
                              Venta #{v.id} - saldo ${Number(v.saldo_pendiente ?? v.neto ?? 0).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Formas de pago</span>
                          <button
                            type="button"
                            className="px-2 py-1 rounded bg-white/10 border border-white/10 text-xs"
                            onClick={addPagoMetodoRow}
                            disabled={pagoDeudaSaving}
                          >
                            Agregar metodo
                          </button>
                        </div>
                        {metodosPagoLoading && (
                          <div className="text-xs text-slate-400">Cargando metodos...</div>
                        )}
                        {metodosPagoError && (
                          <div className="text-xs text-rose-300">{metodosPagoError}</div>
                        )}
                        {!metodosPagoLoading && !metodosPago.length && (
                          <div className="text-xs text-amber-200">
                            No hay metodos de pago configurados. Crea uno en Configuracion.
                          </div>
                        )}
                        <div className="space-y-2">
                          {pagoMetodos.map((row, index) => {
                            const metodo = metodosPago.find(
                              (m) => String(m.id) === String(row.metodo_id)
                            );
                            const moneda =
                              row.moneda || metodo?.moneda || 'ARS';
                            return (
                              <div
                                key={`metodo-${index}`}
                                className="grid grid-cols-1 md:grid-cols-[1.4fr_0.8fr_auto] gap-2 items-center"
                              >
                                <select
                                  className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                                  value={row.metodo_id}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const metodoSel = metodosPago.find(
                                      (m) => String(m.id) === String(value)
                                    );
                                    updatePagoMetodo(index, {
                                      metodo_id: value,
                                      moneda: metodoSel?.moneda || '',
                                    });
                                  }}
                                  disabled={pagoDeudaSaving || metodosPagoLoading}
                                >
                                  <option value="">Selecciona metodo</option>
                                  {metodosPago.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.nombre}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                                    value={row.monto}
                                    onChange={(e) =>
                                      updatePagoMetodo(index, { monto: e.target.value })
                                    }
                                    disabled={pagoDeudaSaving}
                                  />
                                  <span className="text-[11px] text-slate-400 w-10 text-right">
                                    {moneda || 'ARS'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs disabled:opacity-50"
                                  onClick={() => removePagoMetodoRow(index)}
                                  disabled={pagoMetodos.length <= 1 || pagoDeudaSaving}
                                >
                                  Quitar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Total</span>
                          <span className="text-slate-100">
                            ${totalPagoMetodos.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <label className="block">
                        <div className="text-slate-300 mb-1">Fecha</div>
                        <input
                          type="date"
                          className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1 text-sm text-slate-100"
                          value={pagoDeudaForm.fecha}
                          onChange={(e) =>
                            setPagoDeudaForm((prev) => ({
                              ...prev,
                              fecha: e.target.value,
                            }))
                          }
                          disabled={pagoDeudaSaving}
                        />
                      </label>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-100 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!canSubmitPago}
                        >
                          {pagoDeudaSaving ? 'Registrando...' : 'Registrar pago'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    Métricas avanzadas
                  </h4>
                  <div>
                    Frecuencia prom. entre compras:{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.frecuenciaPromedioDias != null
                        ? `${resumenSeleccionado.frecuenciaPromedioDias.toFixed(1)} días`
                        : '-'}
                    </span>
                  </div>
                  <div>
                    Ranking (top clientes):{' '}
                    <span className="text-slate-200">
                      {resumenSeleccionado.rankingPosicion
                        ? `#${resumenSeleccionado.rankingPosicion} de ${resumenSeleccionado.rankingTotal}`
                        : resumenSeleccionado.rankingTotal
                        ? 'Fuera del top cargado'
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    CRM
                  </h4>
                  <div>
                    Oportunidades abiertas:{' '}
                    <span className="text-slate-200">{crmOpps.length}</span>
                  </div>
                  <div>
                    Actividades pendientes:{' '}
                    <span className="text-slate-200">{crmActs.length}</span>
                  </div>
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={crearActividadRapida}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-xs"
                    >
                      Nueva actividad rápida
                    </button>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-slate-400 uppercase mb-1">
                      Oportunidades
                    </div>
                    <ul className="space-y-1 text-xs text-slate-200">
                      {crmOpps.slice(0, 5).map((o) => (
                        <li key={o.id}>
                          <span className="font-medium">{o.titulo}</span>{' '}
                          <span className="text-slate-400">
                            · {o.fase}
                            {typeof o.valor_estimado === 'number'
                              ? ` · $${o.valor_estimado.toFixed(0)}`
                              : ''}
                          </span>
                        </li>
                      ))}
                      {!crmOpps.length && (
                        <li className="text-slate-400">Sin oportunidades abiertas</li>
                      )}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-slate-400 uppercase mb-1">
                      Actividades pendientes
                    </div>
                    <ul className="space-y-1 text-xs text-slate-200">
                      {crmActs.slice(0, 5).map((a) => (
                        <li key={a.id}>
                          <span className="font-medium">{a.tipo}</span>{' '}
                          <span>- {a.asunto}</span>{' '}
                          <span className="text-slate-400">
                            {a.fecha_hora
                              ? `· ${new Date(a.fecha_hora).toLocaleString()}`
                              : ''}{' '}
                            · {a.estado}
                          </span>
                        </li>
                      ))}
                      {!crmActs.length && (
                        <li className="text-slate-400">Sin actividades pendientes</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showHistorialModal && selectedCliente && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-xl w-full max-w-4xl p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm text-slate-400">Historial de pagos y entregas</div>
                <div className="text-base text-slate-100">
                  Cliente #{selectedCliente.id} - {selectedCliente.nombre}
                  {selectedCliente.apellido ? ` ${selectedCliente.apellido}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                onClick={() => setShowHistorialModal(false)}
                disabled={historialDeleting}
              >
                Cerrar
              </button>
            </div>
            {historialError && (
              <div className="text-xs text-rose-300">{historialError}</div>
            )}
            {historialLoading ? (
              <div className="py-6 text-center text-slate-400">Cargando historial...</div>
            ) : (
              <div className="overflow-x-auto text-xs md:text-sm max-h-[60vh]">
                <table className="min-w-full">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="py-1 pr-2">Fecha</th>
                      <th className="py-1 pr-2">Tipo</th>
                      <th className="py-1 pr-2">Referencia</th>
                      <th className="py-1 pr-2">Monto</th>
                      <th className="py-1 pr-2">Detalle</th>
                      <th className="py-1 pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {historialPagos.map((h) => (
                      <tr key={`${h.tipo}-${h.id}`} className="border-t border-white/10 hover:bg-white/5">
                        <td className="py-1 pr-2">
                          {h.fecha ? new Date(h.fecha).toLocaleString() : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.tipo === 'pago_venta'
                            ? 'Pago venta'
                            : h.tipo === 'pago_cuenta'
                              ? 'Pago cuenta corriente'
                              : h.tipo === 'pago_deuda_inicial'
                                ? 'Pago deuda'
                                : 'Entrega'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.tipo === 'pago_venta'
                            ? h.venta_id
                              ? `Venta #${h.venta_id}`
                              : '-'
                            : h.tipo === 'pago_cuenta'
                              ? 'Cuenta corriente'
                              : h.tipo === 'entrega_venta'
                                ? h.venta_id
                                  ? `Entrega venta #${h.venta_id}`
                                  : 'Entrega'
                                : 'Pago deuda'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.monto != null ? `$${Number(h.monto || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.detalle
                            ? h.tipo === 'entrega_venta'
                              ? `Se entrego ${h.detalle}`
                              : h.detalle
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.tipo === 'entrega_venta' ? (
                            <span className="text-slate-500">-</span>
                          ) : (
                            <button
                              type="button"
                              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-[11px]"
                              onClick={() => eliminarPagoHistorial(h)}
                              disabled={historialDeleting}
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!historialPagos.length && (
                      <tr>
                        <td className="py-2 text-slate-400" colSpan={6}>
                          Sin movimientos registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
