import { useEffect, useState } from 'react';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { Api } from '../lib/api';

type Ticket = { id: number; asunto: string; descripcion?: string; estado: string; prioridad: string; tipo: string; cliente_nombre?: string; creado_en: string };

export default function Postventa() {
  const [estado, setEstado] = useState<string>('abierto');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await Api.tickets({ estado: estado || undefined, limit: 50 });
        setTickets(t || []);
      } catch (_) { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [estado]);

  const estados = ['abierto','en_progreso','resuelto','cerrado'];

  return (
    <div className="space-y-6">
      <ChartCard title="Tickets" right={
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="bg-white/10 border border-white/10 rounded px-2 py-1 text-sm">
          <option value="">Todos</option>
          {estados.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      }>
        <DataTable headers={
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2 px-2">Asunto</th>
              <th className="py-2 px-2">Cliente</th>
              <th className="py-2 px-2">Estado</th>
              <th className="py-2 px-2">Prioridad</th>
              <th className="py-2 px-2">Tipo</th>
              <th className="py-2 px-2">Creado</th>
            </tr>
          </thead>
        }>
          <tbody className="text-slate-200">
            {(loading ? [] : tickets).map((t) => (
              <tr key={t.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{t.asunto}</td>
                <td className="py-2 px-2">{t.cliente_nombre || '-'}</td>
                <td className="py-2 px-2">{t.estado}</td>
                <td className="py-2 px-2">{t.prioridad}</td>
                <td className="py-2 px-2">{t.tipo}</td>
                <td className="py-2 px-2">{new Date(t.creado_en).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && tickets.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={6}>Sin tickets</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>
    </div>
  );
}

