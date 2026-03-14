import { useState, useMemo, type FormEvent } from 'react';
import { Api } from '../../../lib/api';
import Button from '../../../ui/Button';
import HelpTooltip from '../../../components/HelpTooltip';
import type { RepricingRuleRow, RepricingPreviewRow } from '../types';

export default function RepricingTab() {
  const [repricingRules, setRepricingRules] = useState<RepricingRuleRow[]>([]);
  const [repricingRulesLoading, setRepricingRulesLoading] = useState(false);
  const [repricingRulesError, setRepricingRulesError] = useState<string | null>(null);
  const [repricingPreviewRows, setRepricingPreviewRows] = useState<RepricingPreviewRow[]>([]);
  const [repricingPreviewLoading, setRepricingPreviewLoading] = useState(false);
  const [repricingPreviewError, setRepricingPreviewError] = useState<string | null>(null);
  const [repricingApplyMsg, setRepricingApplyMsg] = useState<string | null>(null);
  const [repricingLimit, setRepricingLimit] = useState<number>(120);
  const [repricingProductIds, setRepricingProductIds] = useState<string>('');
  const [repricingSaving, setRepricingSaving] = useState(false);
  const [repricingForm, setRepricingForm] = useState({
    nombre: '',
    scope: 'global' as 'global' | 'categoria' | 'proveedor' | 'producto',
    scope_ref_id: '',
    channel: '' as '' | 'local' | 'distribuidor' | 'final',
    margin_min: '0.15',
    margin_target: '0.30',
    usd_pass_through: '1',
    rounding_step: '1',
    prioridad: '100',
    status: 'active' as 'active' | 'inactive',
  });

  function parseIds(raw: string): number[] {
    return String(raw || '')
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((x) => Number.isInteger(x) && x > 0);
  }

  async function loadRepricingRules(showError = false) {
    setRepricingRulesLoading(true);
    if (!showError) setRepricingRulesError(null);
    try {
      const rows = await Api.ownerRepricingRules();
      const safeRows = Array.isArray(rows)
        ? rows.map((r: any) => ({
            id: Number(r.id || 0),
            nombre: String(r.nombre || ''),
            scope: String(r.scope || 'global') as RepricingRuleRow['scope'],
            scope_ref_id: r.scope_ref_id == null ? null : Number(r.scope_ref_id),
            channel: r.channel ? (String(r.channel) as RepricingRuleRow['channel']) : null,
            margin_min: Number(r.margin_min || 0),
            margin_target: Number(r.margin_target || 0),
            usd_pass_through: Number(r.usd_pass_through || 0),
            rounding_step: Number(r.rounding_step || 1),
            prioridad: Number(r.prioridad || 100),
            status: String(r.status || 'active') as RepricingRuleRow['status'],
          }))
        : [];
      setRepricingRules(safeRows);
    } catch (e) {
      if (showError) {
        setRepricingRulesError(e instanceof Error ? e.message : 'No se pudieron cargar reglas de repricing');
      }
      setRepricingRules([]);
    } finally {
      setRepricingRulesLoading(false);
    }
  }

  async function handleCreateRepricingRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRepricingRulesError(null);
    setRepricingApplyMsg(null);
    if (repricingForm.nombre.trim().length < 3) {
      setRepricingRulesError('Nombre de regla invalido');
      return;
    }
    setRepricingSaving(true);
    try {
      await Api.ownerCreateRepricingRule({
        nombre: repricingForm.nombre.trim(),
        scope: repricingForm.scope,
        scope_ref_id: repricingForm.scope_ref_id ? Number(repricingForm.scope_ref_id) : null,
        channel: repricingForm.channel || null,
        margin_min: Number(repricingForm.margin_min || 0.15),
        margin_target: Number(repricingForm.margin_target || 0.3),
        usd_pass_through: Number(repricingForm.usd_pass_through || 1),
        rounding_step: Number(repricingForm.rounding_step || 1),
        prioridad: Number(repricingForm.prioridad || 100),
        status: repricingForm.status,
      });
      setRepricingForm((prev) => ({ ...prev, nombre: '', scope_ref_id: '' }));
      await loadRepricingRules(false);
    } catch (e) {
      setRepricingRulesError(e instanceof Error ? e.message : 'No se pudo crear la regla');
    } finally {
      setRepricingSaving(false);
    }
  }

  async function handleToggleRepricingRule(rule: RepricingRuleRow) {
    setRepricingRulesError(null);
    try {
      await Api.ownerUpdateRepricingRule(rule.id, {
        status: rule.status === 'active' ? 'inactive' : 'active',
      });
      await loadRepricingRules(false);
    } catch (e) {
      setRepricingRulesError(e instanceof Error ? e.message : 'No se pudo actualizar la regla');
    }
  }

  async function handlePreviewRepricing() {
    setRepricingPreviewLoading(true);
    setRepricingPreviewError(null);
    setRepricingApplyMsg(null);
    try {
      const ids = parseIds(repricingProductIds);
      const out = await Api.ownerRepricingPreview({
        limit: Math.max(1, Number(repricingLimit) || 1),
        product_ids: ids.length ? ids : undefined,
      });
      const rows = Array.isArray(out)
        ? out.map((r: any) => ({
            producto_id: Number(r.producto_id || 0),
            producto: String(r.producto || ''),
            regla_nombre: r.regla_nombre ? String(r.regla_nombre) : '',
            costo_ars: Number(r.costo_ars || 0),
            precio_actual: r.precio_actual || {},
            precio_sugerido: r.precio_sugerido || {},
          }))
        : [];
      setRepricingPreviewRows(rows);
    } catch (e) {
      setRepricingPreviewError(e instanceof Error ? e.message : 'No se pudo generar preview');
      setRepricingPreviewRows([]);
    } finally {
      setRepricingPreviewLoading(false);
    }
  }

  async function handleApplyRepricing() {
    setRepricingPreviewError(null);
    setRepricingApplyMsg(null);
    try {
      const ids = parseIds(repricingProductIds);
      const out = await Api.ownerRepricingApply({
        limit: Math.max(1, Number(repricingLimit) || 1),
        product_ids: ids.length ? ids : undefined,
      });
      setRepricingApplyMsg(`Repricing aplicado. Productos actualizados: ${Number(out?.changed || 0)}`);
      const preview = Array.isArray(out?.preview) ? out.preview : [];
      if (preview.length) {
        setRepricingPreviewRows(
          preview.map((r: any) => ({
            producto_id: Number(r.producto_id || 0),
            producto: String(r.producto || ''),
            regla_nombre: r.regla_nombre ? String(r.regla_nombre) : '',
            costo_ars: Number(r.costo_ars || 0),
            precio_actual: r.precio_actual || {},
            precio_sugerido: r.precio_sugerido || {},
          }))
        );
      }
    } catch (e) {
      setRepricingPreviewError(e instanceof Error ? e.message : 'No se pudo aplicar repricing');
    }
  }

  const repricingImpact = useMemo(() => {
    const totals = repricingPreviewRows.reduce(
      (acc, row) => {
        const actual = Number(row.precio_actual?.venta || 0);
        const sugerido = Number(row.precio_sugerido?.venta || 0);
        acc.actual += actual;
        acc.sugerido += sugerido;
        return acc;
      },
      { actual: 0, sugerido: 0 }
    );
    const delta = totals.sugerido - totals.actual;
    const deltaPct = totals.actual > 0 ? (delta / totals.actual) * 100 : 0;
    return { ...totals, delta, deltaPct };
  }, [repricingPreviewRows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="app-card finance-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <span>Nueva regla de repricing</span>
            <HelpTooltip>
              Las reglas de repricing sirven para recalcular precios segun margen minimo, objetivo y canal antes de aplicar cambios masivos.
            </HelpTooltip>
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-2" onSubmit={handleCreateRepricingRule}>
            <input
              className="input-modern text-xs md:col-span-2"
              placeholder="Nombre de regla"
              value={repricingForm.nombre}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <select
              className="input-modern text-xs"
              value={repricingForm.scope}
              onChange={(e) =>
                setRepricingForm((prev) => ({
                  ...prev,
                  scope: e.target.value as 'global' | 'categoria' | 'proveedor' | 'producto',
                }))
              }
            >
              <option value="global">Global</option>
              <option value="categoria">Categoria</option>
              <option value="proveedor">Proveedor</option>
              <option value="producto">Producto</option>
            </select>
            <input
              className="input-modern text-xs"
              placeholder="Scope ref id"
              value={repricingForm.scope_ref_id}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, scope_ref_id: e.target.value }))}
            />
            <select
              className="input-modern text-xs"
              value={repricingForm.channel}
              onChange={(e) =>
                setRepricingForm((prev) => ({
                  ...prev,
                  channel: e.target.value as '' | 'local' | 'distribuidor' | 'final',
                }))
              }
            >
              <option value="">Canal: todos</option>
              <option value="local">Local</option>
              <option value="distribuidor">Distribuidor</option>
              <option value="final">Final</option>
            </select>
            <input
              className="input-modern text-xs"
              placeholder="Prioridad"
              value={repricingForm.prioridad}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, prioridad: e.target.value }))}
            />
            <input
              className="input-modern text-xs"
              placeholder="Margen minimo"
              value={repricingForm.margin_min}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, margin_min: e.target.value }))}
            />
            <input
              className="input-modern text-xs"
              placeholder="Margen objetivo"
              value={repricingForm.margin_target}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, margin_target: e.target.value }))}
            />
            <input
              className="input-modern text-xs"
              placeholder="USD pass"
              value={repricingForm.usd_pass_through}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, usd_pass_through: e.target.value }))}
            />
            <input
              className="input-modern text-xs"
              placeholder="Rounding"
              value={repricingForm.rounding_step}
              onChange={(e) => setRepricingForm((prev) => ({ ...prev, rounding_step: e.target.value }))}
            />
            <select
              className="input-modern text-xs"
              value={repricingForm.status}
              onChange={(e) =>
                setRepricingForm((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" className="h-8 px-3 text-xs" disabled={repricingSaving}>
                {repricingSaving ? 'Guardando...' : 'Guardar regla'}
              </Button>
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => loadRepricingRules(true)} disabled={repricingRulesLoading}>
                {repricingRulesLoading ? 'Actualizando...' : 'Actualizar reglas'}
              </Button>
            </div>
          </form>
          {repricingRulesError && <div className="text-xs text-rose-300 mt-2">{repricingRulesError}</div>}
        </div>

        <div className="app-card finance-card p-4">
          <div className="text-sm text-slate-300 mb-2">Reglas cargadas</div>
          <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
            {repricingRules.length === 0 && <div className="text-xs text-slate-500">Sin reglas.</div>}
            {repricingRules.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-200">{r.nombre}</div>
                  <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleToggleRepricingRule(r)}>
                    {r.status === 'active' ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
                <div className="text-[11px] text-slate-400">
                  {r.scope}
                  {r.scope_ref_id ? ` #${r.scope_ref_id}` : ''} - {r.channel || 'all'} - prioridad {r.prioridad}
                </div>
                <div className="text-[11px] text-slate-500">
                  min {r.margin_min} | target {r.margin_target} | pass {r.usd_pass_through}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="app-card finance-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <input
            className="input-modern text-xs grow min-w-[260px]"
            placeholder="Producto IDs (coma), ej: 10,11,45"
            value={repricingProductIds}
            onChange={(e) => setRepricingProductIds(e.target.value)}
          />
          <input
            type="number"
            min={1}
            className="input-modern text-xs w-24"
            value={repricingLimit}
            onChange={(e) => setRepricingLimit(Number(e.target.value) || 1)}
          />
          <Button type="button" className="h-8 px-3 text-xs" onClick={handlePreviewRepricing} disabled={repricingPreviewLoading}>
            {repricingPreviewLoading ? 'Simulando...' : 'Simular'}
          </Button>
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleApplyRepricing} disabled={repricingPreviewLoading}>
            Aplicar
          </Button>
        </div>
        {repricingPreviewError && <div className="text-xs text-rose-300">{repricingPreviewError}</div>}
        {repricingApplyMsg && <div className="text-xs text-emerald-300">{repricingApplyMsg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-slate-400 uppercase">Actual</div>
            <div className="text-base font-semibold font-data text-slate-100">
              ${repricingImpact.actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-slate-400 uppercase">Sugerido</div>
            <div className="text-base font-semibold font-data text-cyan-200">
              ${repricingImpact.sugerido.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-slate-400 uppercase">Delta</div>
            <div className="text-base font-semibold font-data text-emerald-200">
              ${repricingImpact.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({repricingImpact.deltaPct.toFixed(2)}%)
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 px-2">Producto</th>
                <th className="py-2 px-2 text-right">Costo ARS</th>
                <th className="py-2 px-2 text-right">Venta actual</th>
                <th className="py-2 px-2 text-right">Venta sugerida</th>
                <th className="py-2 px-2 text-right">Delta %</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {repricingPreviewRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 px-2 text-slate-500">
                    Ejecuta simulacion para ver impacto.
                  </td>
                </tr>
              )}
              {repricingPreviewRows.map((r) => {
                const actual = Number(r.precio_actual?.venta || 0);
                const sugerido = Number(r.precio_sugerido?.venta || 0);
                const deltaPct = actual > 0 ? ((sugerido - actual) / actual) * 100 : 0;
                return (
                  <tr key={r.producto_id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2 px-2">{r.producto}</td>
                    <td className="py-2 px-2 text-right font-data">${Number(r.costo_ars || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right font-data">${actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right font-data">${sugerido.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-2 text-right font-data">{deltaPct.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
