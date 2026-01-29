import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Api } from '../lib/api';

type Movimiento = {
  id: number;
  producto_id: number;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  motivo: string;
  referencia: string;
  fecha: string;
  deposito_id?: number | null;
  deposito_nombre?: string | null;
  usuario_id?: number | null;
  usuario_nombre?: string | null;
};

export default function Stock() {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const location = useLocation();

  async function load(currentSearch: string) {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 200 };
      const sp = new URLSearchParams(currentSearch);
      const dep = sp.get('deposito_id');
      if (dep) {
        const n = Number(dep);
        if (Number.isFinite(n) && n > 0) params.deposito_id = n;
      }
      const data = await Api.movimientos(params);
      setMovs(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(location.search);
  }, [location.search]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Stock</h2>
      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
        <div className="flex items-center gap-2 mb-3">
          <input className="h-10 rounded-md border border-slate-200 px-3" placeholder="Buscar referencia o motivo" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Producto</th>
                  <th className="py-2">Cantidad</th>
                  <th className="py-2">Motivo</th>
                  <th className="py-2">Referencia</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {movs
                  .filter(m => [m.motivo, m.referencia].join(' ').toLowerCase().includes(q.toLowerCase()))
                  .map((m) => (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="py-2">{new Date(m.fecha).toLocaleString()}</td>
                      <td className="py-2 capitalize">{m.tipo}</td>
                      <td className="py-2">#{m.producto_id}</td>
                      <td className="py-2">{m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}</td>
                      <td className="py-2">{m.motivo}</td>
                      <td className="py-2">
                        {m.referencia}
                        {m.deposito_nombre
                          ? ` · Dep: ${m.deposito_nombre}`
                          : m.deposito_id
                          ? ` · Dep #${m.deposito_id}`
                          : ''}
                        {m.usuario_nombre
                          ? ` · Usuario: ${m.usuario_nombre}`
                          : m.usuario_id
                          ? ` · Usuario #${m.usuario_id}`
                          : ''}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
