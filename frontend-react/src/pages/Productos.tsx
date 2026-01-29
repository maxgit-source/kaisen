import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Api } from '../lib/api';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Producto = {
  id: number;
  name: string;
  codigo?: string | null;
  category_id: number;
  category_name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
  stock_quantity: number;
  costo_pesos?: number | null;
  costo_dolares?: number | null;
  tipo_cambio?: number | null;
  margen_local?: number | null;
  margen_distribuidor?: number | null;
  price_local?: number | null;
  price_distribuidor?: number | null;
  precio_final?: number | null;
  marca?: string | null;
  modelo?: string | null;
  procesador?: string | null;
  ram_gb?: number | null;
  almacenamiento_gb?: number | null;
  pantalla_pulgadas?: number | null;
  camara_mp?: number | null;
  bateria_mah?: number | null;
};

type HistorialRow = {
  id: number;
  producto_id: number;
  proveedor_id: number | null;
  proveedor_nombre?: string | null;
  fecha: string;
  costo_pesos: number | null;
  costo_dolares: number | null;
  tipo_cambio: number | null;
  margen_local: number | null;
  margen_distribuidor: number | null;
  precio_local: number | null;
  precio_distribuidor: number | null;
  usuario_nombre?: string | null;
};

type FormState = {
  name: string;
  codigo: string;
  description: string;
  price: string;
  image_url: string;
  category_id: string;
  stock_quantity: string;
  costo_pesos: string;
  costo_dolares: string;
  tipo_cambio: string;
  margen_local: string;
  margen_distribuidor: string;
  precio_final: string;
  marca: string;
  modelo: string;
  procesador: string;
  ram_gb: string;
  almacenamiento_gb: string;
  pantalla_pulgadas: string;
  camara_mp: string;
  bateria_mah: string;
};

const emptyForm: FormState = {
  name: '',
  codigo: '',
  description: '',
  price: '',
  image_url: '',
  category_id: '',
  stock_quantity: '',
  costo_pesos: '',
  costo_dolares: '',
  tipo_cambio: '',
  margen_local: '15',
  margen_distribuidor: '45',
  precio_final: '',
  marca: '',
  modelo: '',
  procesador: '',
  ram_gb: '',
  almacenamiento_gb: '',
  pantalla_pulgadas: '',
  camara_mp: '',
  bateria_mah: '',
};

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [codigoLookupMsg, setCodigoLookupMsg] = useState<string | null>(null);
  const [codigoLookupError, setCodigoLookupError] = useState<string | null>(null);
  const [codigoLookupLoading, setCodigoLookupLoading] = useState(false);

  const [historialProducto, setHistorialProducto] = useState<Producto | null>(null);
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);

  const [lastCostoEdit, setLastCostoEdit] = useState<'pesos' | 'dolares' | null>(null);
  const [dolarBlue, setDolarBlue] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  const filteredProductos = productos;

  const costoPesosNumber = useMemo(
    () => Number(form.costo_pesos || '0') || 0,
    [form.costo_pesos]
  );
  const costoDolaresNumber = useMemo(
    () => Number(form.costo_dolares || '0') || 0,
    [form.costo_dolares]
  );
  const tipoCambioNumber = useMemo(
    () => (form.tipo_cambio ? Number(form.tipo_cambio) || 0 : 0),
    [form.tipo_cambio]
  );
  const margenLocalNumber = useMemo(
    () => (form.margen_local ? Number(form.margen_local) / 100 : 0.15),
    [form.margen_local]
  );
  const margenDistribuidorNumber = useMemo(
    () => (form.margen_distribuidor ? Number(form.margen_distribuidor) / 100 : 0.45),
    [form.margen_distribuidor]
  );

  const precioLocalCalc = useMemo(() => {
    if (costoPesosNumber > 0) return costoPesosNumber * (1 + margenLocalNumber);
    return 0;
  }, [costoPesosNumber, margenLocalNumber]);

  const precioDistribuidorCalc = useMemo(() => {
    if (costoPesosNumber > 0) return costoPesosNumber * (1 + margenDistribuidorNumber);
    return 0;
  }, [costoPesosNumber, margenDistribuidorNumber]);

  const canSubmit = useMemo(() => {
    const hasCore =
      form.name &&
      form.category_id &&
      form.image_url;
    const hasAnyCost =
      (form.costo_pesos && Number(form.costo_pesos || '0') > 0) ||
      (form.costo_dolares && Number(form.costo_dolares || '0') > 0);
    return Boolean(hasCore && hasAnyCost);
  }, [form]);

  useEffect(() => {
    if (!tipoCambioNumber || tipoCambioNumber <= 0 || !lastCostoEdit) return;

    if (lastCostoEdit === 'dolares' && costoDolaresNumber > 0) {
      const nuevoPesos = Number((costoDolaresNumber * tipoCambioNumber).toFixed(2));
      const actualPesos = Number(form.costo_pesos || '0') || 0;
      if (!Number.isNaN(nuevoPesos) && nuevoPesos !== actualPesos) {
        setForm((prev) => ({ ...prev, costo_pesos: String(nuevoPesos) }));
      }
    } else if (lastCostoEdit === 'pesos' && costoPesosNumber > 0) {
      const nuevoDolares = Number((costoPesosNumber / tipoCambioNumber).toFixed(2));
      const actualDolares = Number(form.costo_dolares || '0') || 0;
      if (!Number.isNaN(nuevoDolares) && nuevoDolares !== actualDolares) {
        setForm((prev) => ({ ...prev, costo_dolares: String(nuevoDolares) }));
      }
    }
  }, [tipoCambioNumber, lastCostoEdit, costoPesosNumber, costoDolaresNumber, form.costo_pesos, form.costo_dolares]);

  async function load(pageToLoad?: number) {
    const targetPage = pageToLoad ?? currentPage ?? 1;
    setLoading(true);
    setError(null);
    try {
      const q = search.trim() || undefined;
      const [prodsResponse, cats, configDolar] = await Promise.all([
        Api.productos({ q, page: targetPage, paginated: true }),
        Api.categorias(),
        Api.getDolarBlue().catch(() => null),
      ]);
      const resp: any = prodsResponse || {};
      const data = (resp.data || resp) as Producto[];
      setProductos(data);
      setCategorias(cats as { id: number; name: string }[]);
      if (configDolar && typeof (configDolar as any).valor === 'number') {
        setDolarBlue((configDolar as any).valor);
      }
      const total = Number(resp.total ?? data.length ?? 0);
      const pageFromApi = Number(resp.page ?? targetPage) || targetPage;
      const totalPagesFromApi = Number(resp.totalPages ?? 1) || 1;
      setTotalProductos(total);
      setCurrentPage(pageFromApi);
      setTotalPages(totalPagesFromApi);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      load(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!dolarBlue) return;
    setForm((prev) => {
      if (editingProducto || prev.tipo_cambio) return prev;
      return { ...prev, tipo_cambio: String(dolarBlue) };
    });
  }, [dolarBlue, editingProducto]);

  async function handleImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo subir la imagen';
      setUploadError(msg);
    } finally {
      setUploadingImage(false);
    }
  }

  async function onSubmitForm(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    const payload: any = {
      name: form.name,
      codigo: form.codigo.trim() || undefined,
      description: form.description,
      price: precioLocalCalc > 0 ? precioLocalCalc : undefined,
      image_url: form.image_url,
      category_id: Number(form.category_id),
      stock_quantity: Number(form.stock_quantity || '0'),
      precio_costo_pesos: costoPesosNumber || undefined,
      precio_costo_dolares: costoDolaresNumber || undefined,
      tipo_cambio: tipoCambioNumber || undefined,
      margen_local: margenLocalNumber,
      margen_distribuidor: margenDistribuidorNumber,
      precio_final:
        form.precio_final !== ''
          ? Number(form.precio_final) || 0
          : undefined,
      marca: form.marca || undefined,
      modelo: form.modelo || undefined,
      procesador: form.procesador || undefined,
      ram_gb: form.ram_gb !== '' ? Number(form.ram_gb) || 0 : undefined,
      almacenamiento_gb:
        form.almacenamiento_gb !== '' ? Number(form.almacenamiento_gb) || 0 : undefined,
      pantalla_pulgadas:
        form.pantalla_pulgadas !== '' ? Number(form.pantalla_pulgadas) || 0 : undefined,
      camara_mp: form.camara_mp !== '' ? Number(form.camara_mp) || 0 : undefined,
      bateria_mah: form.bateria_mah !== '' ? Number(form.bateria_mah) || 0 : undefined,
    };
    try {
      if (editingProducto) {
        await Api.actualizarProducto(editingProducto.id, payload);
      } else {
        await Api.crearProducto(payload);
      }
      setForm(emptyForm);
      setEditingProducto(null);
      setCodigoLookupMsg(null);
      setCodigoLookupError(null);
      await load(currentPage);
    } catch (e: any) {
      if (e && e.code === 'APPROVAL_REQUIRED') {
        const id = e.aprobacionId || e.aprobacion_id;
        const baseMsg =
          'El cambio requiere aprobación de un administrador o gerente y ya quedó registrado.';
        setError(
          id ? `${baseMsg} ID de aprobación: ${id}.` : baseMsg
        );
        return;
      }
      setError(
        e instanceof Error
          ? e.message
          : editingProducto
          ? 'No se pudo actualizar el producto'
          : 'No se pudo crear el producto'
      );
    }
  }

  function startEdit(p: Producto) {
    setError(null);
    setUploadError(null);
    setEditingProducto(p);
    setHistorialProducto(null);
    setForm({
      name: p.name || '',
      codigo: p.codigo || '',
      description: (p.description as string | null) || '',
      price: '',
      image_url: p.image_url || '',
      category_id: p.category_id ? String(p.category_id) : '',
      stock_quantity: String(p.stock_quantity ?? ''),
      costo_pesos: p.costo_pesos != null ? String(p.costo_pesos) : '',
      costo_dolares: p.costo_dolares != null ? String(p.costo_dolares) : '',
      tipo_cambio: p.tipo_cambio != null ? String(p.tipo_cambio) : '',
      margen_local:
        p.margen_local != null
          ? String((p.margen_local * 100).toFixed(2))
          : emptyForm.margen_local,
      margen_distribuidor:
        p.margen_distribuidor != null
          ? String((p.margen_distribuidor * 100).toFixed(2))
          : emptyForm.margen_distribuidor,
      precio_final: p.precio_final != null ? String(p.precio_final) : '',
      marca: p.marca || '',
      modelo: p.modelo || '',
      procesador: p.procesador || '',
      ram_gb: p.ram_gb != null ? String(p.ram_gb) : '',
      almacenamiento_gb: p.almacenamiento_gb != null ? String(p.almacenamiento_gb) : '',
      pantalla_pulgadas: p.pantalla_pulgadas != null ? String(p.pantalla_pulgadas) : '',
      camara_mp: p.camara_mp != null ? String(p.camara_mp) : '',
      bateria_mah: p.bateria_mah != null ? String(p.bateria_mah) : '',
    });
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  }

  async function lookupCodigo() {
    const codigo = form.codigo.trim();
    if (!codigo) {
      setCodigoLookupError('Ingresa un codigo');
      setCodigoLookupMsg(null);
      return;
    }
    setCodigoLookupLoading(true);
    setCodigoLookupError(null);
    setCodigoLookupMsg(null);
    try {
      const prod = await Api.productoPorCodigo(codigo);
      setCodigoLookupMsg('Producto encontrado, listo para editar.');
      startEdit(prod as Producto);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.toLowerCase().includes('no encontrado')) {
        setCodigoLookupMsg('Codigo libre, listo para crear.');
      } else {
        setCodigoLookupError(msg || 'No se pudo verificar el codigo');
      }
    } finally {
      setCodigoLookupLoading(false);
    }
  }

  async function cargarHistorial(p: Producto) {
    setHistorialProducto(p);
    setHistorial([]);
    setHistorialError(null);
    setHistorialLoading(true);
    try {
      const rows = await Api.productoHistorial(p.id);
      setHistorial(rows as HistorialRow[]);
    } catch (e) {
      setHistorialError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar el historial de precios'
      );
    } finally {
      setHistorialLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Productos
      </h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4 space-y-4">
        <form
          onSubmit={onSubmitForm}
          className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4"
        >
          {(error || uploadError) && (
            <div className="md:col-span-6 space-y-1">
              {error && <Alert kind="error" message={error} />}
              {uploadError && <Alert kind="error" message={uploadError} />}
            </div>
          )}
          {(codigoLookupError || codigoLookupMsg) && (
            <div className="md:col-span-6 space-y-1">
              {codigoLookupError && <Alert kind="error" message={codigoLookupError} />}
              {codigoLookupMsg && <Alert kind="info" message={codigoLookupMsg} />}
            </div>
          )}
          {editingProducto && (
            <div className="md:col-span-6 flex items-center justify-between text-xs text-amber-200">
              <span>Editando producto: {editingProducto.name}</span>
              <button
                type="button"
                className="underline hover:text-amber-100"
                onClick={() => {
                  setEditingProducto(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar edición
              </button>
            </div>
          )}
          <input
            className="input-modern text-sm"
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="md:col-span-2 flex gap-2">
            <input
              className="input-modern text-sm flex-1"
              placeholder="Codigo (lector)"
              value={form.codigo}
              onChange={(e) => {
                setForm({ ...form, codigo: e.target.value });
                setCodigoLookupMsg(null);
                setCodigoLookupError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  lookupCodigo();
                }
              }}
            />
            <button
              type="button"
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs text-slate-200"
              onClick={lookupCodigo}
              disabled={codigoLookupLoading}
            >
              {codigoLookupLoading ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
          <input
            className="input-modern text-sm md:col-span-2"
            placeholder="Descripción"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Precio venta base (calculado)"
            type="number"
            step="0.01"
            value={precioLocalCalc.toFixed(2)}
            readOnly
          />
          <input
            className="input-modern text-sm"
            placeholder="Precio final (manual)"
            type="number"
            step="0.01"
            value={form.precio_final}
            onChange={(e) =>
              setForm({ ...form, precio_final: e.target.value })
            }
          />
          <select
            className="input-modern text-sm"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-2 flex flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              className="input-modern text-sm"
              onChange={handleImageFileChange}
            />
            <input
              className="input-modern text-xs"
              placeholder="URL imagen (se completa al subir)"
              value={form.image_url}
              onChange={(e) =>
                setForm({ ...form, image_url: e.target.value })
              }
            />
            {uploadingImage && (
              <span className="text-[11px] text-slate-400">
                Subiendo imagen a Cloudinary...
              </span>
            )}
          </div>
          <input
            className="input-modern text-sm"
            placeholder="Costo en pesos"
            type="number"
            step="0.01"
            value={form.costo_pesos}
            onChange={(e) =>
              setForm((prev) => {
                setLastCostoEdit('pesos');
                return { ...prev, costo_pesos: e.target.value };
              })
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Costo en dólares"
            type="number"
            step="0.01"
            value={form.costo_dolares}
            onChange={(e) =>
              setForm((prev) => {
                setLastCostoEdit('dolares');
                return { ...prev, costo_dolares: e.target.value };
              })
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Tipo de cambio"
            type="number"
            step="0.0001"
            value={form.tipo_cambio}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tipo_cambio: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="% margen local"
            type="number"
            step="0.01"
            value={form.margen_local}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, margen_local: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="% margen distribuidor"
            type="number"
            step="0.01"
            value={form.margen_distribuidor}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                margen_distribuidor: e.target.value,
              }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Stock inicial"
            type="number"
            value={form.stock_quantity}
            onChange={(e) =>
              setForm({ ...form, stock_quantity: e.target.value })
            }
          />
          <div className="md:col-span-6 text-xs text-slate-400 uppercase">
            Especificaciones fijas
          </div>
          <input
            className="input-modern text-sm"
            placeholder="Marca"
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
          />
          <input
            className="input-modern text-sm"
            placeholder="Modelo"
            value={form.modelo}
            onChange={(e) => setForm({ ...form, modelo: e.target.value })}
          />
          <input
            className="input-modern text-sm md:col-span-2"
            placeholder="Procesador"
            value={form.procesador}
            onChange={(e) => setForm({ ...form, procesador: e.target.value })}
          />
          <input
            className="input-modern text-sm"
            placeholder="RAM (GB)"
            type="number"
            value={form.ram_gb}
            onChange={(e) => setForm({ ...form, ram_gb: e.target.value })}
          />
          <input
            className="input-modern text-sm"
            placeholder="Almacenamiento (GB)"
            type="number"
            value={form.almacenamiento_gb}
            onChange={(e) => setForm({ ...form, almacenamiento_gb: e.target.value })}
          />
          <input
            className="input-modern text-sm"
            placeholder="Pantalla (pulgadas)"
            type="number"
            step="0.1"
            value={form.pantalla_pulgadas}
            onChange={(e) => setForm({ ...form, pantalla_pulgadas: e.target.value })}
          />
          <input
            className="input-modern text-sm"
            placeholder="Camara (MP)"
            type="number"
            value={form.camara_mp}
            onChange={(e) => setForm({ ...form, camara_mp: e.target.value })}
          />
          <input
            className="input-modern text-sm"
            placeholder="Bateria (mAh)"
            type="number"
            value={form.bateria_mah}
            onChange={(e) => setForm({ ...form, bateria_mah: e.target.value })}
          />
          <div className="md:col-span-2 flex flex-col gap-1 text-xs text-slate-300">
            <div>
              Precio distribuidor estimado:{' '}
              <span className="font-semibold">
                ${precioLocalCalc.toFixed(2)}
              </span>
            </div>
            <div>
              Precio mayorista estimado:{' '}
              <span className="font-semibold">
                ${precioDistribuidorCalc.toFixed(2)}
              </span>
            </div>
          </div>
          <Button disabled={!canSubmit} className="md:col-span-6">
            {editingProducto ? 'Guardar cambios' : 'Crear'}
          </Button>
        </form>

        <div className="flex justify-end mb-3">
          <div className="flex items-center gap-2 w-full max-w-xs">
            <span className="text-slate-400 text-sm whitespace-nowrap">
              Buscar:
            </span>
            <input
              className="input-modern text-sm w-full"
              placeholder="Nombre de producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Código</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Costo ARS</th>
                  <th className="py-2">Precio distribuidor</th>
                  <th className="py-2">Precio mayorista</th>
                  <th className="py-2">Precio final</th>
                  <th className="py-2">Stock</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {filteredProductos.length === 0 && productos.length > 0 && (
                  <tr>
                    <td className="py-2 text-slate-400" colSpan={9}>
                      Sin productos que coincidan con la búsqueda
                    </td>
                  </tr>
                )}
                {filteredProductos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.codigo || '-'}</td>
                    <td className="py-2">{p.category_name}</td>
                    <td className="py-2">
                      {p.costo_pesos != null
                        ? `$${p.costo_pesos.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-2">
                      {p.price_local != null
                        ? `$${p.price_local.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-2">
                      {p.price_distribuidor != null
                        ? `$${p.price_distribuidor.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-2">
                      {p.precio_final != null
                        ? `$${p.precio_final.toFixed(2)}`
                        : `$${p.price.toFixed(2)}`}
                    </td>
                    <td className="py-2">{p.stock_quantity}</td>
                    <td className="py-2 space-x-2">
                      <button
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                        onClick={() => startEdit(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs"
                        onClick={async () => {
                          if (!window.confirm(`Eliminar producto ${p.name}?`))
                            return;
                          try {
                            await Api.eliminarProducto(p.id);
                            await load(currentPage);
                          } catch (e: any) {
                            setError(e?.message || 'No se pudo eliminar');
                          }
                        }}
                      >
                        Eliminar
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-xs"
                        onClick={() => cargarHistorial(p)}
                      >
                        Historial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-slate-300">
          <button
            className="px-3 py-1 rounded bg-white/5 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || currentPage <= 1}
            onClick={() => {
              if (loading || currentPage <= 1) return;
              load(currentPage - 1);
            }}
          >
            Anterior
          </button>
          <span>
            Página {Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1))} de{' '}
            {Math.max(totalPages, 1)}
            {totalProductos ? ` (${totalProductos} productos)` : ''}
          </span>
          <button
            className="px-3 py-1 rounded bg-white/5 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || currentPage >= totalPages}
            onClick={() => {
              if (loading || currentPage >= totalPages) return;
              load(currentPage + 1);
            }}
          >
            Siguiente
          </button>
        </div>

        {historialProducto && (
          <div className="mt-6 border-t border-white/10 pt-4 space-y-2">
            <div className="text-sm font-medium text-slate-200">
              Historial de precios para {historialProducto.name}
            </div>
            {historialLoading ? (
              <div className="text-xs text-slate-400">
                Cargando historial...
              </div>
            ) : historialError ? (
              <Alert kind="error" message={historialError} />
            ) : historial.length === 0 ? (
              <div className="text-xs text-slate-400">
                Sin historial registrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="py-1 pr-2">Fecha</th>
                      <th className="py-1 pr-2">Proveedor</th>
                      <th className="py-1 pr-2">Costo ARS</th>
                      <th className="py-1 pr-2">Costo USD</th>
                      <th className="py-1 pr-2">TC</th>
                      <th className="py-1 pr-2">% Local</th>
                      <th className="py-1 pr-2">% Dist.</th>
                      <th className="py-1 pr-2">Local ARS</th>
                      <th className="py-1 pr-2">Dist. ARS</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {historial.map((h) => (
                      <tr
                        key={h.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="py-1 pr-2">
                          {h.fecha
                            ? new Date(h.fecha).toLocaleString()
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.proveedor_nombre || '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.costo_pesos != null
                            ? `$${h.costo_pesos.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.costo_dolares != null
                            ? `$${h.costo_dolares.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.tipo_cambio != null
                            ? h.tipo_cambio.toFixed(2)
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.margen_local != null
                            ? `${(h.margen_local * 100).toFixed(1)}%`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.margen_distribuidor != null
                            ? `${(h.margen_distribuidor * 100).toFixed(1)}%`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.precio_local != null
                            ? `$${h.precio_local.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.precio_distribuidor != null
                            ? `$${h.precio_distribuidor.toFixed(2)}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
