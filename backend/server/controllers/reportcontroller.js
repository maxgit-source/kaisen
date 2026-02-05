const { query } = require('../db/pg');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const configRepo = require('../db/repositories/configRepository');

async function deudas(req, res) {
  try {
    const { cliente_id } = req.query || {};
    if (cliente_id) {
      const { rows } = await query('SELECT * FROM vista_deudas WHERE cliente_id = $1', [cliente_id]);
      return res.json(rows);
    }
    const { rows } = await query('SELECT * FROM vista_deudas');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener deudas' });
  }
}

async function gananciasMensuales(req, res) {
  try {
    const { rows } = await query('SELECT mes, total_ventas::float AS total_ventas, total_gastos::float AS total_gastos, ganancia_neta::float AS ganancia_neta FROM vista_ganancias_mensuales ORDER BY mes');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener ganancias mensuales' });
  }
}

async function stockBajo(req, res) {
  try {
    const { rows } = await query('SELECT * FROM vista_stock_bajo ORDER BY producto_id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener stock bajo' });
  }
}

async function topClientes(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 200);
    const { rows } = await query('SELECT * FROM vista_top_clientes ORDER BY total_comprado DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener top clientes' });
  }
}

// Productos mas comprados por cliente
async function topProductosCliente(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de cliente invalido' });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 100);
    const { rows } = await query(
      `SELECT d.producto_id,
              p.nombre AS producto_nombre,
              SUM(d.cantidad) AS total_cantidad,
              SUM(d.subtotal)::float AS total_monto
         FROM ventas_detalle d
         JOIN ventas v ON v.id = d.venta_id
         JOIN productos p ON p.id = d.producto_id
        WHERE v.cliente_id = $1
          AND v.estado_pago <> 'cancelado'
        GROUP BY d.producto_id, p.nombre
        ORDER BY total_cantidad DESC, total_monto DESC
        LIMIT $2`,
      [id, limit]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener productos del cliente' });
  }
}

// Helper: parse YYYY-MM-DD or fallback to today/relative ranges if missing
function parseDateParam(value, fallback) {
  if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return fallback;
}

function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function resolveRange(query = {}) {
  const { desde, hasta } = query || {};
  const today = new Date();
  const defaultHasta = today;
  const defaultDesde = new Date(today);
  defaultDesde.setDate(defaultDesde.getDate() - 29);

  const fromDate = parseDateParam(desde, defaultDesde);
  const toDate = parseDateParam(hasta, defaultHasta);

  const fromStr = toIsoDate(fromDate);
  const toStr = toIsoDate(toDate);
  const days = Math.max(1, Math.round((toDate - fromDate) / (24 * 60 * 60 * 1000)) + 1);

  return { fromDate, toDate, fromStr, toStr, days };
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value) {
  return `$ ${normalizeNumber(value, 0).toFixed(2)}`;
}

function percentChange(current, previous) {
  const prev = normalizeNumber(previous, 0);
  if (!prev) return null;
  const cur = normalizeNumber(current, 0);
  return ((cur - prev) / prev) * 100;
}

function buildDateFilter(column, params, fromStr, toStr) {
  params.push(fromStr);
  const fromIdx = params.length;
  params.push(toStr);
  const toIdx = params.length;
  return [`date(${column}, 'localtime') >= date($${fromIdx})`, `date(${column}, 'localtime') <= date($${toIdx})`];
}

function parseOptionalId(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeHexColor(value) {
  if (!value) return null;
  let hex = String(value).trim();
  if (!hex) return null;
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toUpperCase();
}

function blendWithWhite(hex, ratio = 0.85) {
  const clean = normalizeHexColor(hex);
  if (!clean) return null;
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const nr = clamp(Math.round(r + (255 - r) * ratio));
  const ng = clamp(Math.round(g + (255 - g) * ratio));
  const nb = clamp(Math.round(b + (255 - b) * ratio));
  return `${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
}

function getFontColorForHex(hex) {
  const clean = normalizeHexColor(hex);
  if (!clean) return '0F172A';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 150 ? 'FFFFFF' : '0F172A';
}

async function getPriceLabelsForReport() {
  try {
    const { getTextParam } = require('../db/repositories/configRepository');
    const [local, distribuidor, finalLabel] = await Promise.all([
      getTextParam('price_label_local'),
      getTextParam('price_label_distribuidor'),
      getTextParam('price_label_final'),
    ]);
    return {
      local: local || 'Precio Distribuidor',
      distribuidor: distribuidor || 'Precio Mayorista',
      final: finalLabel || 'Precio Final',
    };
  } catch {
    return {
      local: 'Precio Distribuidor',
      distribuidor: 'Precio Mayorista',
      final: 'Precio Final',
    };
  }
}

// Obtener movimientos diarios/mensuales de ventas y gastos entre un rango
async function movimientos(req, res) {
  try {
    const { desde, hasta, agregado } = req.query || {};
    const today = new Date();
    const defaultHasta = today;
    const defaultDesde = new Date(today);
    // Por defecto, últimos 30 días
    defaultDesde.setDate(defaultDesde.getDate() - 29);

    const fromDate = parseDateParam(desde, defaultDesde);
    const toDate = parseDateParam(hasta, defaultHasta);

    const agg = (agregado || 'dia').toString().toLowerCase();

    let rows;
    if (agg === 'mes') {
      // Reutilizar vista_ganancias_mensuales para agregación mensual
      const { rows: qrows } = await query(
        `SELECT date(mes) AS fecha,
                total_ventas AS total_ventas,
                total_gastos AS total_gastos,
                ganancia_neta AS ganancia_neta
           FROM vista_ganancias_mensuales
          WHERE mes >= date($1, 'start of month')
            AND mes <= date($2, 'start of month')
          ORDER BY mes`,
        [fromDate.toISOString().slice(0, 10), toDate.toISOString().slice(0, 10)]
      );
      rows = qrows;
    } else {
      // Agregado diario: combinar ventas (neto) y gastos
      const { rows: qrows } = await query(
        `WITH RECURSIVE rango(fecha) AS (
           SELECT date($1)
           UNION ALL
           SELECT date(fecha, '+1 day') FROM rango WHERE fecha < date($2)
         ),
         ventas_d AS (
           SELECT date(fecha, 'localtime') AS fecha, SUM(neto) AS total_ventas
             FROM ventas
            WHERE date(fecha, 'localtime') >= date($1) AND date(fecha, 'localtime') <= date($2)
            GROUP BY date(fecha, 'localtime')
         ),
         deudas_ini_d AS (
           SELECT date(fecha, 'localtime') AS fecha, SUM(monto) AS total_deudas_ini
             FROM clientes_deudas_iniciales_pagos
            WHERE date(fecha, 'localtime') >= date($1) AND date(fecha, 'localtime') <= date($2)
            GROUP BY date(fecha, 'localtime')
         ),
         gastos_d AS (
           SELECT date(fecha, 'localtime') AS fecha, SUM(monto) AS total_gastos
             FROM gastos
            WHERE date(fecha, 'localtime') >= date($1) AND date(fecha, 'localtime') <= date($2)
            GROUP BY date(fecha, 'localtime')
         )
         SELECT r.fecha,
                COALESCE(v.total_ventas, 0) + COALESCE(di.total_deudas_ini, 0) AS total_ventas,
                COALESCE(g.total_gastos, 0) AS total_gastos,
                (COALESCE(v.total_ventas, 0) + COALESCE(di.total_deudas_ini, 0)) - COALESCE(g.total_gastos, 0) AS ganancia_neta
           FROM rango r
      LEFT JOIN ventas_d v ON v.fecha = r.fecha
      LEFT JOIN deudas_ini_d di ON di.fecha = r.fecha
      LEFT JOIN gastos_d g ON g.fecha = r.fecha
          ORDER BY r.fecha`,
        [fromDate.toISOString().slice(0, 10), toDate.toISOString().slice(0, 10)]
      );
      rows = qrows;
    }

    const data = rows.map((r) => ({
      fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
      totalVentas: Number(r.total_ventas || 0),
      totalGastos: Number(r.total_gastos || 0),
      gananciaNeta: Number(r.ganancia_neta || 0),
    }));

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los movimientos' });
  }
}

async function buildMovimientosResumen({ range, filters = {} }) {
  const { fromStr, toStr, days } = range;
  const usuarioId = filters.usuarioId;
  const depositoId = filters.depositoId;
  const clienteId = filters.clienteId;
  const proveedorId = filters.proveedorId;

  // Ventas
  const ventasParams = [];
  const ventasWhere = buildDateFilter('v.fecha', ventasParams, fromStr, toStr);
  ventasWhere.push("v.estado_pago <> 'cancelado'");
  if (usuarioId) {
    ventasParams.push(usuarioId);
    ventasWhere.push(`v.usuario_id = $${ventasParams.length}`);
  }
  if (depositoId) {
    ventasParams.push(depositoId);
    ventasWhere.push(`v.deposito_id = $${ventasParams.length}`);
  }
  if (clienteId) {
    ventasParams.push(clienteId);
    ventasWhere.push(`v.cliente_id = $${ventasParams.length}`);
  }
  const { rows: ventasRows } = await query(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(v.neto),0) AS total
       FROM ventas v
      WHERE ${ventasWhere.join(' AND ')}`,
    ventasParams
  );
  const ventasCount = normalizeNumber(ventasRows[0]?.cantidad, 0);
  const ventasTotal = normalizeNumber(ventasRows[0]?.total, 0);

  // Compras
  const comprasParams = [];
  const comprasWhere = buildDateFilter('c.fecha', comprasParams, fromStr, toStr);
  comprasWhere.push("c.estado <> 'cancelado'");
  if (proveedorId) {
    comprasParams.push(proveedorId);
    comprasWhere.push(`c.proveedor_id = $${comprasParams.length}`);
  }
  const { rows: comprasRows } = await query(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(c.total_costo),0) AS total
       FROM compras c
      WHERE ${comprasWhere.join(' AND ')}`,
    comprasParams
  );
  const comprasCount = normalizeNumber(comprasRows[0]?.cantidad, 0);
  const comprasTotal = normalizeNumber(comprasRows[0]?.total, 0);

  // Pagos de clientes
  const pagosParams = [];
  const pagosWhere = buildDateFilter('p.fecha', pagosParams, fromStr, toStr);
  if (clienteId) {
    pagosParams.push(clienteId);
    pagosWhere.push(`p.cliente_id = $${pagosParams.length}`);
  }
  const { rows: pagosRows } = await query(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(p.monto),0) AS total
       FROM pagos p
      WHERE ${pagosWhere.join(' AND ')}`,
    pagosParams
  );
  const pagosCount = normalizeNumber(pagosRows[0]?.cantidad, 0);
  const pagosTotal = normalizeNumber(pagosRows[0]?.total, 0);

  // Gastos
  const gastosParams = [];
  const gastosWhere = buildDateFilter('g.fecha', gastosParams, fromStr, toStr);
  if (usuarioId) {
    gastosParams.push(usuarioId);
    gastosWhere.push(`g.usuario_id = $${gastosParams.length}`);
  }
  const { rows: gastosRows } = await query(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(g.monto),0) AS total
       FROM gastos g
      WHERE ${gastosWhere.join(' AND ')}`,
    gastosParams
  );
  const gastosCount = normalizeNumber(gastosRows[0]?.cantidad, 0);
  const gastosTotal = normalizeNumber(gastosRows[0]?.total, 0);

  // Pagos a proveedores
  const pagosProvParams = [];
  const pagosProvWhere = buildDateFilter('pp.fecha', pagosProvParams, fromStr, toStr);
  if (proveedorId) {
    pagosProvParams.push(proveedorId);
    pagosProvWhere.push(`pp.proveedor_id = $${pagosProvParams.length}`);
  }
  const { rows: pagosProvRows } = await query(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(pp.monto),0) AS total
       FROM pagos_proveedores pp
      WHERE ${pagosProvWhere.join(' AND ')}`,
    pagosProvParams
  );
  const pagosProvCount = normalizeNumber(pagosProvRows[0]?.cantidad, 0);
  const pagosProvTotal = normalizeNumber(pagosProvRows[0]?.total, 0);

  const ticketProm = ventasCount > 0 ? ventasTotal / ventasCount : 0;
  const cobranzaRatio = ventasTotal > 0 ? pagosTotal / ventasTotal : null;

  // Mejores dias
  const { rows: topVentaDiaRows } = await query(
    `SELECT date(v.fecha, 'localtime') AS dia, SUM(v.neto) AS total
       FROM ventas v
      WHERE ${ventasWhere.join(' AND ')}
      GROUP BY date(v.fecha, 'localtime')
      ORDER BY total DESC
      LIMIT 1`,
    ventasParams
  );
  const topVentaDia = topVentaDiaRows[0] || null;

  const { rows: topGastoDiaRows } = await query(
    `SELECT date(g.fecha, 'localtime') AS dia, SUM(g.monto) AS total
       FROM gastos g
      WHERE ${gastosWhere.join(' AND ')}
      GROUP BY date(g.fecha, 'localtime')
      ORDER BY total DESC
      LIMIT 1`,
    gastosParams
  );
  const topGastoDia = topGastoDiaRows[0] || null;

  // Comparativo periodo anterior
  const prevEnd = new Date(`${fromStr}T00:00:00Z`);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
  const prevRange = {
    fromStr: toIsoDate(prevStart),
    toStr: toIsoDate(prevEnd),
  };

  const ventasPrevParams = [];
  const ventasPrevWhere = buildDateFilter('v.fecha', ventasPrevParams, prevRange.fromStr, prevRange.toStr);
  ventasPrevWhere.push("v.estado_pago <> 'cancelado'");
  if (usuarioId) {
    ventasPrevParams.push(usuarioId);
    ventasPrevWhere.push(`v.usuario_id = $${ventasPrevParams.length}`);
  }
  if (depositoId) {
    ventasPrevParams.push(depositoId);
    ventasPrevWhere.push(`v.deposito_id = $${ventasPrevParams.length}`);
  }
  if (clienteId) {
    ventasPrevParams.push(clienteId);
    ventasPrevWhere.push(`v.cliente_id = $${ventasPrevParams.length}`);
  }
  const { rows: ventasPrevRows } = await query(
    `SELECT COALESCE(SUM(v.neto),0) AS total
       FROM ventas v
      WHERE ${ventasPrevWhere.join(' AND ')}`,
    ventasPrevParams
  );
  const ventasPrevTotal = normalizeNumber(ventasPrevRows[0]?.total, 0);
  const ventasPct = percentChange(ventasTotal, ventasPrevTotal);

  const resumenLines = [
    `Período: ${fromStr} a ${toStr}`,
    `Ventas: ${ventasCount} ops · ${formatCurrency(ventasTotal)}`,
    `Compras: ${comprasCount} ops · ${formatCurrency(comprasTotal)}`,
    `Pagos de clientes: ${pagosCount} ops · ${formatCurrency(pagosTotal)}`,
    `Gastos: ${gastosCount} ops · ${formatCurrency(gastosTotal)}`,
    `Pagos a proveedores: ${pagosProvCount} ops · ${formatCurrency(pagosProvTotal)}`,
  ];

  const actividadLines = [];
  if (ventasCount > 0) {
    actividadLines.push(`Ticket promedio: ${formatCurrency(ticketProm)}`);
  }
  if (topVentaDia && topVentaDia.dia) {
    actividadLines.push(`Mejor día de ventas: ${topVentaDia.dia} · ${formatCurrency(topVentaDia.total)}`);
  }
  if (topGastoDia && topGastoDia.dia) {
    actividadLines.push(`Día de mayor gasto: ${topGastoDia.dia} · ${formatCurrency(topGastoDia.total)}`);
  }
  if (ventasPct != null) {
    const sign = ventasPct >= 0 ? '+' : '';
    actividadLines.push(`Variación de ventas vs período anterior: ${sign}${ventasPct.toFixed(1)}%`);
  }
  if (cobranzaRatio != null) {
    actividadLines.push(`Cobranza / ventas: ${(cobranzaRatio * 100).toFixed(1)}%`);
  }

  // Recomendaciones por reglas simples
  const recomendLines = [];

  if (ventasTotal > 0 && cobranzaRatio != null && cobranzaRatio < 0.8) {
    recomendLines.push('Reforzar cobranzas: el nivel cobrado está por debajo del 80% de las ventas.');
  }
  if (gastosTotal > ventasTotal * 0.6 && ventasTotal > 0) {
    recomendLines.push('Revisar gastos: superan el 60% del total de ventas del período.');
  }
  if (comprasTotal > ventasTotal && ventasTotal > 0) {
    recomendLines.push('Compras por encima de ventas: ajustar stock o planificar compras por rotación.');
  }

  // Stock bajo
  const { rows: stockRows } = await query(
    `SELECT producto_id, nombre, cantidad_disponible, stock_minimo
       FROM vista_stock_bajo
      ORDER BY (stock_minimo - cantidad_disponible) DESC
      LIMIT 3`
  );
  if (stockRows.length) {
    const items = stockRows.map((r) => `${r.nombre} (${r.cantidad_disponible}/${r.stock_minimo})`).join(', ');
    recomendLines.push(`Reponer stock: ${items}.`);
  }

  // Clientes con deuda
  let debtThreshold = null;
  try {
    const { getDebtThreshold } = require('../db/repositories/configRepository');
    debtThreshold = await getDebtThreshold();
  } catch {}
  const { rows: debtRows } = await query(
    `SELECT c.id, c.nombre, c.apellido, v.deuda_pendiente
       FROM vista_deudas v
       JOIN clientes c ON c.id = v.cliente_id
      WHERE v.deuda_pendiente > 0
      ORDER BY v.deuda_pendiente DESC
      LIMIT 3`
  );
  const filteredDebts = debtThreshold
    ? debtRows.filter((r) => Number(r.deuda_pendiente || 0) >= Number(debtThreshold))
    : debtRows;
  if (filteredDebts.length) {
    const items = filteredDebts
      .map((r) => `${r.nombre} ${r.apellido || ''}`.trim() + ` (${formatCurrency(r.deuda_pendiente)})`)
      .join(', ');
    recomendLines.push(`Cobranza prioritaria: ${items}.`);
  }

  // Top clientes del periodo
  const topClientesParams = [];
  const topClientesWhere = buildDateFilter('v.fecha', topClientesParams, fromStr, toStr);
  topClientesWhere.push("v.estado_pago <> 'cancelado'");
  if (usuarioId) {
    topClientesParams.push(usuarioId);
    topClientesWhere.push(`v.usuario_id = $${topClientesParams.length}`);
  }
  if (depositoId) {
    topClientesParams.push(depositoId);
    topClientesWhere.push(`v.deposito_id = $${topClientesParams.length}`);
  }
  if (clienteId) {
    topClientesParams.push(clienteId);
    topClientesWhere.push(`v.cliente_id = $${topClientesParams.length}`);
  }
  const { rows: topClientesRows } = await query(
    `SELECT c.id, c.nombre, c.apellido, SUM(v.neto) AS total
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
      WHERE ${topClientesWhere.join(' AND ')}
      GROUP BY c.id, c.nombre, c.apellido
      ORDER BY total DESC
      LIMIT 3`,
    topClientesParams
  );
  if (topClientesRows.length) {
    const items = topClientesRows.map((r) => `${r.nombre} ${r.apellido || ''}`.trim()).join(', ');
    recomendLines.push(`Fidelizar clientes clave: ${items}.`);
  }

  // Top productos del periodo
  const topProdParams = [];
  const topProdWhere = buildDateFilter('v.fecha', topProdParams, fromStr, toStr);
  topProdWhere.push("v.estado_pago <> 'cancelado'");
  if (usuarioId) {
    topProdParams.push(usuarioId);
    topProdWhere.push(`v.usuario_id = $${topProdParams.length}`);
  }
  if (depositoId) {
    topProdParams.push(depositoId);
    topProdWhere.push(`v.deposito_id = $${topProdParams.length}`);
  }
  if (clienteId) {
    topProdParams.push(clienteId);
    topProdWhere.push(`v.cliente_id = $${topProdParams.length}`);
  }
  const { rows: topProdRows } = await query(
    `SELECT p.id, p.nombre, SUM(d.cantidad) AS unidades, SUM(d.subtotal) AS monto
       FROM ventas_detalle d
       JOIN ventas v ON v.id = d.venta_id
       JOIN productos p ON p.id = d.producto_id
      WHERE ${topProdWhere.join(' AND ')}
      GROUP BY p.id, p.nombre
      ORDER BY unidades DESC, monto DESC
      LIMIT 3`,
    topProdParams
  );
  if (topProdRows.length) {
    const items = topProdRows.map((r) => `${r.nombre} (${normalizeNumber(r.unidades, 0)} u.)`).join(', ');
    recomendLines.push(`Productos destacados: ${items}.`);
  }

  // Top vendedor
  if (!usuarioId) {
    const topVendedorParams = [];
    const topVendedorWhere = buildDateFilter('v.fecha', topVendedorParams, fromStr, toStr);
    topVendedorWhere.push("v.estado_pago <> 'cancelado'");
    const { rows: topVendRows } = await query(
      `SELECT u.id, u.nombre, SUM(v.neto) AS total
         FROM ventas v
         JOIN usuarios u ON u.id = v.usuario_id
        WHERE ${topVendedorWhere.join(' AND ')}
        GROUP BY u.id, u.nombre
        ORDER BY total DESC
        LIMIT 1`,
      topVendedorParams
    );
    if (topVendRows.length) {
      const v = topVendRows[0];
      recomendLines.push(`Reconocer desempeño: ${v.nombre} lidera ventas con ${formatCurrency(v.total)}.`);
    }
  }

  const sections = [
    { title: 'Resumen ejecutivo', lines: resumenLines.slice(0, 6) },
    { title: 'Actividad del período', lines: actividadLines.slice(0, 6) },
    { title: 'Recomendaciones', lines: recomendLines.slice(0, 8) },
  ];

  return {
    generated_at: new Date().toISOString(),
    range: { desde: fromStr, hasta: toStr, dias: days },
    totals: {
      ventas: ventasTotal,
      compras: comprasTotal,
      pagos_clientes: pagosTotal,
      gastos: gastosTotal,
      pagos_proveedores: pagosProvTotal,
    },
    sections,
  };
}

async function movimientosDetalle(req, res) {
  try {
    const range = resolveRange(req.query || {});
    const usuarioId = Number.isInteger(Number(req.query?.usuario_id))
      ? Number(req.query.usuario_id)
      : null;
    const depositoId = Number.isInteger(Number(req.query?.deposito_id))
      ? Number(req.query.deposito_id)
      : null;
    const clienteId = Number.isInteger(Number(req.query?.cliente_id))
      ? Number(req.query.cliente_id)
      : null;
    const proveedorId = Number.isInteger(Number(req.query?.proveedor_id))
      ? Number(req.query.proveedor_id)
      : null;
    const tiposRaw = String(req.query?.tipo || '').toLowerCase();
    const tipos = new Set(tiposRaw.split(',').map((t) => t.trim()).filter(Boolean));

    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 200, 1), 2000);
    const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);

    const include = (name) => (tipos.size ? tipos.has(name) : true);
    const movimientosList = [];

    if (include('ventas')) {
      const params = [];
      const where = buildDateFilter('v.fecha', params, range.fromStr, range.toStr);
      where.push("v.estado_pago <> 'cancelado'");
      if (usuarioId) {
        params.push(usuarioId);
        where.push(`v.usuario_id = $${params.length}`);
      }
      if (depositoId) {
        params.push(depositoId);
        where.push(`v.deposito_id = $${params.length}`);
      }
      if (clienteId) {
        params.push(clienteId);
        where.push(`v.cliente_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT v.id, v.fecha, v.neto AS monto, v.usuario_id, v.deposito_id,
                c.id AS cliente_id, c.nombre, c.apellido
           FROM ventas v
           JOIN clientes c ON c.id = v.cliente_id
          WHERE ${where.join(' AND ')}`,
        params
      );
      rows.forEach((r) => {
        movimientosList.push({
          tipo: 'venta',
          fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
          monto: normalizeNumber(r.monto, 0),
          descripcion: `Venta #${r.id} - ${r.nombre} ${r.apellido || ''}`.trim(),
          referencia_id: r.id,
          cliente_id: r.cliente_id,
          usuario_id: r.usuario_id,
          deposito_id: r.deposito_id,
        });
      });
    }

    if (include('compras')) {
      const params = [];
      const where = buildDateFilter('c.fecha', params, range.fromStr, range.toStr);
      where.push("c.estado <> 'cancelado'");
      if (proveedorId) {
        params.push(proveedorId);
        where.push(`c.proveedor_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT c.id, c.fecha, c.total_costo AS monto, p.id AS proveedor_id, p.nombre AS proveedor_nombre
           FROM compras c
           JOIN proveedores p ON p.id = c.proveedor_id
          WHERE ${where.join(' AND ')}`,
        params
      );
      rows.forEach((r) => {
        movimientosList.push({
          tipo: 'compra',
          fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
          monto: normalizeNumber(r.monto, 0),
          descripcion: `Compra #${r.id} - ${r.proveedor_nombre}`,
          referencia_id: r.id,
          proveedor_id: r.proveedor_id,
        });
      });
    }

    if (include('pagos')) {
      const params = [];
      const where = buildDateFilter('p.fecha', params, range.fromStr, range.toStr);
      if (clienteId) {
        params.push(clienteId);
        where.push(`p.cliente_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT p.id, p.fecha, p.monto, p.venta_id, c.id AS cliente_id, c.nombre, c.apellido
           FROM pagos p
           JOIN clientes c ON c.id = p.cliente_id
          WHERE ${where.join(' AND ')}`,
        params
      );
      rows.forEach((r) => {
        movimientosList.push({
          tipo: 'pago_cliente',
          fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
          monto: normalizeNumber(r.monto, 0),
          descripcion: `Pago #${r.id} - ${r.nombre} ${r.apellido || ''}`.trim(),
          referencia_id: r.id,
          venta_id: r.venta_id,
          cliente_id: r.cliente_id,
        });
      });
    }

    if (include('gastos')) {
      const params = [];
      const where = buildDateFilter('g.fecha', params, range.fromStr, range.toStr);
      if (usuarioId) {
        params.push(usuarioId);
        where.push(`g.usuario_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT g.id, g.fecha, g.monto, g.descripcion, g.usuario_id
           FROM gastos g
          WHERE ${where.join(' AND ')}`,
        params
      );
      rows.forEach((r) => {
        movimientosList.push({
          tipo: 'gasto',
          fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
          monto: normalizeNumber(r.monto, 0),
          descripcion: `Gasto #${r.id} - ${r.descripcion}`,
          referencia_id: r.id,
          usuario_id: r.usuario_id,
        });
      });
    }

    if (include('pagos_proveedores')) {
      const params = [];
      const where = buildDateFilter('pp.fecha', params, range.fromStr, range.toStr);
      if (proveedorId) {
        params.push(proveedorId);
        where.push(`pp.proveedor_id = $${params.length}`);
      }
      const { rows } = await query(
        `SELECT pp.id, pp.fecha, pp.monto, pp.compra_id, p.id AS proveedor_id, p.nombre AS proveedor_nombre
           FROM pagos_proveedores pp
           JOIN proveedores p ON p.id = pp.proveedor_id
          WHERE ${where.join(' AND ')}`,
        params
      );
      rows.forEach((r) => {
        movimientosList.push({
          tipo: 'pago_proveedor',
          fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
          monto: normalizeNumber(r.monto, 0),
          descripcion: `Pago proveedor #${r.id} - ${r.proveedor_nombre}`,
          referencia_id: r.id,
          compra_id: r.compra_id,
          proveedor_id: r.proveedor_id,
        });
      });
    }

    movimientosList.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const total = movimientosList.length;
    const data = movimientosList.slice(offset, offset + limit);

    res.json({ total, items: data });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener movimientos detallados' });
  }
}

async function movimientosResumen(req, res) {
  try {
    const range = resolveRange(req.query || {});
    const filters = {
      usuarioId: Number.isInteger(Number(req.query?.usuario_id)) ? Number(req.query.usuario_id) : null,
      depositoId: Number.isInteger(Number(req.query?.deposito_id)) ? Number(req.query.deposito_id) : null,
      clienteId: Number.isInteger(Number(req.query?.cliente_id)) ? Number(req.query.cliente_id) : null,
      proveedorId: Number.isInteger(Number(req.query?.proveedor_id)) ? Number(req.query.proveedor_id) : null,
    };
    const resumen = await buildMovimientosResumen({ range, filters });
    res.json(resumen);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo generar el resumen' });
  }
}

async function rankingVendedores(req, res) {
  try {
    const range = resolveRange(req.query || {});
    const metricRaw = await configRepo.getTextParam('ranking_vendedores_metrica');
    const metric = metricRaw === 'margen_venta' ? 'margen_venta' : 'cantidad_ventas';

    const usuarioId = Number.isInteger(Number(req.query?.usuario_id)) ? Number(req.query.usuario_id) : null;
    const depositoId = Number.isInteger(Number(req.query?.deposito_id)) ? Number(req.query.deposito_id) : null;
    const cajaTipo = ['home_office', 'sucursal'].includes(String(req.query?.caja_tipo || ''))
      ? String(req.query.caja_tipo)
      : null;

    const params = [range.fromStr, range.toStr];
    const joinFilters = [
      "v.estado_pago <> 'cancelado'",
      'v.oculto = 0',
      "v.estado_entrega = 'entregado'",
      "date(COALESCE(v.fecha_entrega, v.fecha), 'localtime') >= date($1)",
      "date(COALESCE(v.fecha_entrega, v.fecha), 'localtime') <= date($2)",
    ];
    if (usuarioId) {
      params.push(usuarioId);
      joinFilters.push(`v.usuario_id = $${params.length}`);
    }
    if (depositoId) {
      params.push(depositoId);
      joinFilters.push(`v.deposito_id = $${params.length}`);
    }
    if (cajaTipo) {
      params.push(cajaTipo);
      joinFilters.push(`v.caja_tipo = $${params.length}`);
    }
    const joinWhere = joinFilters.length ? `AND ${joinFilters.join(' AND ')}` : '';
    const orderBy = metric === 'margen_venta' ? 'margen_total DESC' : 'ventas_count DESC';

    const { rows } = await query(
      `SELECT u.id,
              u.nombre,
              u.email,
              u.activo,
              COUNT(DISTINCT v.id) AS ventas_count,
              COALESCE(SUM(d.base_sin_iva), 0) AS ventas_total,
              COALESCE(SUM(d.comision_monto), 0) AS comision_total,
              COALESCE(SUM(d.base_sin_iva - (COALESCE(d.costo_unitario_pesos, 0) * d.cantidad)), 0) AS margen_total
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id AND r.nombre = 'vendedor'
    LEFT JOIN ventas v ON v.usuario_id = u.id ${joinWhere}
    LEFT JOIN ventas_detalle d ON d.venta_id = v.id
     GROUP BY u.id, u.nombre, u.email, u.activo
     ORDER BY ${orderBy}, ventas_total DESC`,
      params
    );

    res.json({ metric, items: rows });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el ranking de vendedores' });
  }
}

async function movimientosDiaProductos(req, res) {
  try {
    const hasRange = Boolean(req.query?.desde || req.query?.hasta);
    let fromStr;
    let toStr;
    let dateStr = null;
    if (hasRange) {
      const range = resolveRange(req.query || {});
      fromStr = range.fromStr;
      toStr = range.toStr;
      if (range.fromStr === range.toStr) {
        dateStr = range.fromStr;
      }
    } else {
      const targetDate = parseDateParam(req.query?.fecha, new Date());
      dateStr = toIsoDate(targetDate);
      fromStr = dateStr;
      toStr = dateStr;
    }

    const usuarioId = Number.isInteger(Number(req.query?.usuario_id)) ? Number(req.query.usuario_id) : null;
    const depositoId = Number.isInteger(Number(req.query?.deposito_id)) ? Number(req.query.deposito_id) : null;
    const zonaId = parseOptionalId(req.query?.zona_id ?? req.query?.zonaId ?? req.query?.zona);
    const cajaTipo = ['home_office', 'sucursal'].includes(String(req.query?.caja_tipo || ''))
      ? String(req.query.caja_tipo)
      : null;

    const params = [fromStr, toStr];
    const where = [
      "v.estado_pago <> 'cancelado'",
      'v.oculto = 0',
      "v.estado_entrega = 'entregado'",
      "date(COALESCE(v.fecha_entrega, v.fecha), 'localtime') >= date($1)",
      "date(COALESCE(v.fecha_entrega, v.fecha), 'localtime') <= date($2)",
    ];
    if (usuarioId) {
      params.push(usuarioId);
      where.push(`v.usuario_id = $${params.length}`);
    }
    if (depositoId) {
      params.push(depositoId);
      where.push(`v.deposito_id = $${params.length}`);
    }
    if (cajaTipo) {
      params.push(cajaTipo);
      where.push(`v.caja_tipo = $${params.length}`);
    }
    if (zonaId != null) {
      params.push(zonaId);
      where.push(`c.zona_id = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT p.id AS producto_id,
              p.nombre AS producto_nombre,
              COALESCE(SUM(d.base_sin_iva), 0) AS total_base,
              COALESCE(SUM(d.cantidad), 0) AS total_cantidad,
              COALESCE(SUM(d.comision_monto), 0) AS comision_total,
              COALESCE(SUM(d.base_sin_iva - (COALESCE(d.costo_unitario_pesos, 0) * d.cantidad)), 0) AS margen_total
         FROM ventas v
         JOIN ventas_detalle d ON d.venta_id = v.id
         JOIN productos p ON p.id = d.producto_id
         JOIN clientes c ON c.id = v.cliente_id
        WHERE ${where.join(' AND ')}
        GROUP BY p.id, p.nombre
        ORDER BY total_base DESC`,
      params
    );

    const total = rows.reduce((acc, r) => acc + Number(r.total_base || 0), 0);
    res.json({ fecha: dateStr, desde: fromStr, hasta: toStr, total, items: rows });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener movimientos del dia' });
  }
}

function formatMovimientosTitle({ fromStr, toStr, days }) {
  if (days === 1) {
    return `Movimientos del dia ${fromStr}`;
  }
  if (days === 7) {
    return `Movimientos de la semana ${fromStr} al ${toStr}`;
  }
  return `Movimientos del ${fromStr} al ${toStr}`;
}

function formatTimestamp(date) {
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function normalizeRemitoBase(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  return value.endsWith('/') ? value : `${value}/`;
}

async function movimientosVentasExcel(req, res) {
  try {
    const range = resolveRange(req.query || {});
    const zonaId = parseOptionalId(req.query?.zona_id ?? req.query?.zonaId ?? req.query?.zona);
    const usuarioId = Number.isInteger(Number(req.query?.usuario_id)) ? Number(req.query.usuario_id) : null;
    const remitoBase = normalizeRemitoBase(req.query?.remito_base);

    const params = [];
    const where = buildDateFilter('v.fecha', params, range.fromStr, range.toStr);
    where.push("v.estado_pago <> 'cancelado'");
    where.push('v.oculto = 0');
    if (zonaId != null) {
      params.push(zonaId);
      where.push(`c.zona_id = $${params.length}`);
    }
    if (usuarioId) {
      params.push(usuarioId);
      where.push(`v.usuario_id = $${params.length}`);
    }

      const { rows } = await query(
        `SELECT v.id AS venta_id,
                v.fecha,
                v.neto AS total_venta,
                v.impuestos AS iva,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                c.localidad,
                c.direccion,
                z.nombre AS zona_nombre,
                z.color_hex AS zona_color,
                u.nombre AS vendedor_nombre,
                COALESCE(pagos.total_pagado, 0) AS total_pagado
           FROM ventas v
           JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN zonas z ON z.id = c.zona_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN (
              SELECT venta_id, SUM(monto) AS total_pagado
                FROM pagos
               WHERE venta_id IS NOT NULL
               GROUP BY venta_id
             ) pagos ON pagos.venta_id = v.id
        WHERE ${where.join(' AND ')}
        ORDER BY date(v.fecha, 'localtime') ASC, v.id ASC`,
      params
    );

    let zonaLabel = 'Todas las zonas';
    if (zonaId != null) {
      try {
        const { rows: zonaRows } = await query('SELECT nombre FROM zonas WHERE id = $1', [zonaId]);
        const zonaNombre = zonaRows[0]?.nombre;
        zonaLabel = zonaNombre ? `Zona: ${zonaNombre}` : `Zona ${zonaId}`;
      } catch {
        zonaLabel = `Zona ${zonaId}`;
      }
    }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema de gestion';
      workbook.created = new Date();

      const columns = [
        { key: 'cliente', width: 28 },
        { key: 'zona', width: 18 },
        { key: 'compra', width: 20 },
        { key: 'localidad', width: 18 },
        { key: 'direccion', width: 36 },
        { key: 'iva', width: 12 },
        { key: 'vendedor', width: 20 },
        { key: 'total', width: 16 },
      ];
      const border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } },
      };

      const legendMap = new Map();
      rows.forEach((row) => {
        const name = row.zona_nombre || 'Sin zona';
        if (!legendMap.has(name)) {
          legendMap.set(name, normalizeHexColor(row.zona_color));
        }
      });
      const legendEntries = Array.from(legendMap.entries());
      const legendRows = Math.max(1, Math.ceil(legendEntries.length / 7));
      const headerRowIndex = 3 + legendRows;
      const dataStartRow = headerRowIndex + 1;

      const sheet = workbook.addWorksheet('Movimientos', {
        views: [{ state: 'frozen', ySplit: headerRowIndex }],
        properties: { defaultRowHeight: 18 },
      });

      columns.forEach((col, idx) => {
        sheet.getColumn(idx + 1).width = col.width;
      });

      const title = formatMovimientosTitle(range);
      sheet.mergeCells('A1:H1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = title;
      titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '111827' } };
      sheet.getRow(1).height = 28;

      sheet.mergeCells('A2:H2');
      const subtitleCell = sheet.getCell('A2');
      subtitleCell.value = `Rango: ${range.fromStr} a ${range.toStr} | ${zonaLabel} | Generado: ${formatTimestamp(new Date())}`;
      subtitleCell.font = { size: 10, italic: true, color: { argb: '334155' } };
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 18;

      for (let i = 0; i < legendRows; i += 1) {
        const rowIndex = 3 + i;
        const legendRow = sheet.getRow(rowIndex);
        legendRow.height = 20;
        if (i === 0) {
          const labelCell = legendRow.getCell(1);
          labelCell.value = 'Leyenda zonas:';
          labelCell.font = { bold: true, color: { argb: '334155' } };
          labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      }

      legendEntries.forEach(([name, color], idx) => {
        const rowIndex = 3 + Math.floor(idx / 7);
        const colIndex = 2 + (idx % 7);
        const cell = sheet.getRow(rowIndex).getCell(colIndex);
        const zoneColor = normalizeHexColor(color) || 'E2E8F0';
        cell.value = name;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { bold: true, color: { argb: getFontColorForHex(zoneColor) } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${zoneColor}` } };
        cell.border = border;
      });

      const headerRow = sheet.getRow(headerRowIndex);
      headerRow.values = ['Cliente', 'Zona', 'Compra', 'Localidad', 'Direccion', 'IVA', 'Vendedor', 'Total (pago)'];
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0EA5E9' } };
        cell.border = border;
      });
      sheet.autoFilter = { from: `A${headerRowIndex}`, to: `H${headerRowIndex}` };

      if (!rows.length) {
        const emptyRow = sheet.getRow(dataStartRow);
        emptyRow.values = ['Sin movimientos', '', '', '', '', 0, '', 0];
        emptyRow.eachCell((cell, col) => {
          cell.border = border;
          cell.alignment = {
            vertical: 'middle',
          horizontal: col === 6 || col === 8 ? 'right' : 'left',
          wrapText: false,
        };
      });
      emptyRow.getCell(6).numFmt = '"$"#,##0.00';
      emptyRow.getCell(8).numFmt = '"$"#,##0.00';
    } else {
        let rowIndex = dataStartRow;
        for (const row of rows) {
          const clienteNombre = `${row.cliente_nombre || ''} ${row.cliente_apellido || ''}`.trim();
          const zonaNombre = row.zona_nombre || 'Sin zona';
          const zonaColor = normalizeHexColor(row.zona_color);
          const zonaRowColor = zonaColor ? blendWithWhite(zonaColor, 0.85) : null;
          const remitoLabel = `Remito #${row.venta_id}`;
          const localidad = row.localidad || '';
          const direccion = row.direccion || '';
          const iva = Number(row.iva || 0);
          const vendedor = row.vendedor_nombre || '';
          const totalPagado = Number(row.total_pagado || 0);

        const sheetRow = sheet.getRow(rowIndex);
        sheetRow.values = [
          clienteNombre,
          zonaNombre,
          remitoLabel,
          localidad,
          direccion,
          iva,
          vendedor,
          totalPagado,
        ];
        sheetRow.height = 20;
        const isEven = rowIndex % 2 === 0;
        sheetRow.eachCell((cell, col) => {
          cell.border = border;
          cell.alignment = {
            vertical: 'middle',
            horizontal: col === 6 || col === 8 ? 'right' : 'left',
            wrapText: col === 5,
          };
            if (zonaRowColor) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${zonaRowColor}` } };
            } else if (isEven) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
            }
          });
          sheetRow.getCell(6).numFmt = '"$"#,##0.00';
          sheetRow.getCell(8).numFmt = '"$"#,##0.00';

          if (remitoBase) {
            const remitoCell = sheetRow.getCell(3);
            remitoCell.value = { text: remitoLabel, hyperlink: `${remitoBase}${row.venta_id}` };
            remitoCell.font = { color: { argb: '2563EB' }, underline: true };
          }

          if (zonaColor) {
            const zonaCell = sheetRow.getCell(2);
            zonaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${zonaColor}` } };
            zonaCell.font = { bold: true, color: { argb: getFontColorForHex(zonaColor) } };
            zonaCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }

          rowIndex += 1;
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `movimientos-${range.fromStr}-a-${range.toStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ error: 'No se pudo generar el excel de movimientos' });
  }
}

// PDF de ganancias para el período seleccionado
async function gananciasPdf(req, res) {
  try {
    const { agregado } = req.query || {};
    const range = resolveRange(req.query || {});
    const { fromDate, toDate, fromStr, toStr } = range;
    const agg = (agregado || 'dia').toString().toLowerCase();
    const filters = {
      usuarioId: Number.isInteger(Number(req.query?.usuario_id)) ? Number(req.query.usuario_id) : null,
      depositoId: Number.isInteger(Number(req.query?.deposito_id)) ? Number(req.query.deposito_id) : null,
      clienteId: Number.isInteger(Number(req.query?.cliente_id)) ? Number(req.query.cliente_id) : null,
      proveedorId: Number.isInteger(Number(req.query?.proveedor_id)) ? Number(req.query.proveedor_id) : null,
    };

    // Reutilizar lógica de movimientos (sin exponer helper fuera)
    let rows;
    if (agg === 'mes') {
      const { rows: qrows } = await query(
        `SELECT date(mes) AS fecha,
                total_ventas AS total_ventas,
                total_gastos AS total_gastos,
                ganancia_neta AS ganancia_neta
           FROM vista_ganancias_mensuales
          WHERE mes >= date($1, 'start of month')
            AND mes <= date($2, 'start of month')
          ORDER BY mes`,
        [fromStr, toStr]
      );
      rows = qrows;
    } else {
      const { rows: qrows } = await query(
        `WITH RECURSIVE rango(fecha) AS (
           SELECT date($1)
           UNION ALL
           SELECT date(fecha, '+1 day') FROM rango WHERE fecha < date($2)
         ),
         ventas_d AS (
           SELECT date(fecha, 'localtime') AS fecha, SUM(neto) AS total_ventas
             FROM ventas
            WHERE date(fecha, 'localtime') >= date($1) AND date(fecha, 'localtime') <= date($2)
            GROUP BY date(fecha, 'localtime')
         ),
         deudas_ini_d AS (
           SELECT date(fecha, 'localtime') AS fecha, SUM(monto) AS total_deudas_ini
             FROM clientes_deudas_iniciales_pagos
            WHERE date(fecha, 'localtime') >= date($1) AND date(fecha, 'localtime') <= date($2)
            GROUP BY date(fecha, 'localtime')
         ),
         gastos_d AS (
           SELECT date(fecha, 'localtime') AS fecha, SUM(monto) AS total_gastos
             FROM gastos
            WHERE date(fecha, 'localtime') >= date($1) AND date(fecha, 'localtime') <= date($2)
            GROUP BY date(fecha, 'localtime')
         )
         SELECT r.fecha,
                COALESCE(v.total_ventas, 0) + COALESCE(di.total_deudas_ini, 0) AS total_ventas,
                COALESCE(g.total_gastos, 0) AS total_gastos,
                (COALESCE(v.total_ventas, 0) + COALESCE(di.total_deudas_ini, 0)) - COALESCE(g.total_gastos, 0) AS ganancia_neta
           FROM rango r
      LEFT JOIN ventas_d v ON v.fecha = r.fecha
      LEFT JOIN deudas_ini_d di ON di.fecha = r.fecha
      LEFT JOIN gastos_d g ON g.fecha = r.fecha
          ORDER BY r.fecha`,
        [fromStr, toStr]
      );
      rows = qrows;
    }

    const movimientosNormalizados = rows.map((r) => ({
      fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
      totalVentas: Number(r.total_ventas || 0),
      totalGastos: Number(r.total_gastos || 0),
      gananciaNeta: Number(r.ganancia_neta || 0),
    }));

    const totalVentas = movimientosNormalizados.reduce((acc, r) => acc + r.totalVentas, 0);
    const totalGastos = movimientosNormalizados.reduce((acc, r) => acc + r.totalGastos, 0);
    const totalGanancia = movimientosNormalizados.reduce((acc, r) => acc + r.gananciaNeta, 0);

    res.setHeader('Content-Type', 'application/pdf');
    const fileName = `informe-ganancias-${fromStr}_a_${toStr}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    const company = process.env.COMPANY_NAME || 'Sistemas de Gestión';
    const periodLabel = `${fromStr} a ${toStr}`;

    doc.fontSize(18).text(company, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(14).text('Informe de ganancias', { align: 'left' });
    doc.fontSize(10).fillColor('#555').text(`Período: ${periodLabel}`);
    doc.moveDown(1);

    // Totales generales
    doc.fillColor('#000').fontSize(11);
    doc.text(`Total ventas: $ ${totalVentas.toFixed(2)}`);
    doc.text(`Total gastos: $ ${totalGastos.toFixed(2)}`);
    doc.font('Helvetica-Bold').text(`Ganancia neta: $ ${totalGanancia.toFixed(2)}`);
    doc.font('Helvetica');
    doc.moveDown(1);

    // Tabla de movimientos
    const startY = doc.y + 5;
    const colX = [doc.page.margins.left, 150, 280, 410];
    doc.fontSize(11).fillColor('#333');
    doc.text('Fecha', colX[0], startY);
    doc.text('Ventas', colX[1], startY, { width: 100, align: 'right' });
    doc.text('Gastos', colX[2], startY, { width: 100, align: 'right' });
    doc.text('Ganancia neta', colX[3], startY, { width: 120, align: 'right' });
    doc
      .moveTo(colX[0], startY + 15)
      .lineTo(doc.page.width - doc.page.margins.right, startY + 15)
      .strokeColor('#999')
      .stroke();

    let y = startY + 20;
    doc.fillColor('#000');
    const lineH = 16;

    for (const r of movimientosNormalizados) {
      doc.text(r.fecha, colX[0], y);
      doc.text(`$ ${r.totalVentas.toFixed(2)}`, colX[1], y, { width: 100, align: 'right' });
      doc.text(`$ ${r.totalGastos.toFixed(2)}`, colX[2], y, { width: 100, align: 'right' });
      doc.text(`$ ${r.gananciaNeta.toFixed(2)}`, colX[3], y, { width: 120, align: 'right' });
      y += lineH;
      if (y > doc.page.height - doc.page.margins.bottom - 50) {
        doc.addPage();
        y = doc.y;
      }
    }

    const isAdmin = (req.authUser?.rol || req.user?.role) === 'admin';
    const resumen = isAdmin ? await buildMovimientosResumen({ range, filters }) : null;
    if (resumen?.sections?.length) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Resumen y recomendaciones');
      doc.moveDown(0.5);

      const lineHeight = 14;
      const drawSection = (section) => {
        if (!section || !section.lines || !section.lines.length) return;
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#334155').text(section.title || 'Sección');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
        for (const line of section.lines) {
          if (doc.y + lineHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
          }
          doc.text(`• ${line}`, { indent: 12 });
        }
        doc.moveDown(0.6);
      };

      resumen.sections.forEach(drawSection);
    }

    doc.end();
  } catch (e) {
    console.error('[reportes] gananciasPdf error', e);
    res.status(500).json({ error: 'No se pudo generar el informe de ganancias' });
  }
}

module.exports = {
  deudas,
  gananciasMensuales,
  stockBajo,
  topClientes,
  topProductosCliente,
  movimientos,
  movimientosDetalle,
  movimientosResumen,
  rankingVendedores,
  movimientosDiaProductos,
  movimientosVentasExcel,
  gananciasPdf,
};

// PDF Remito de entrega por venta
async function remitoPdf(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID invalido' });
    }
    const observaciones = req.query?.observaciones ? String(req.query.observaciones).trim() : '';

    const header = await query(
      `SELECT v.id, v.fecha, v.total::float AS total, v.descuento::float AS descuento, v.impuestos::float AS impuestos,
              v.neto::float AS neto, v.estado_pago, v.estado_entrega,
              c.nombre AS cliente_nombre, COALESCE(c.apellido,'') AS cliente_apellido
         FROM ventas v
         JOIN clientes c ON c.id = v.cliente_id
        WHERE v.id = $1
        LIMIT 1`,
      [id]
    );
    if (!header.rows.length) return res.status(404).json({ error: 'Venta no encontrada' });
    const h = header.rows[0];

    const detalle = await query(
      `SELECT d.cantidad, d.precio_unitario::float AS precio_unitario, p.nombre AS producto_nombre
         FROM ventas_detalle d
         JOIN productos p ON p.id = d.producto_id
        WHERE d.venta_id = $1
        ORDER BY d.id ASC`,
      [id]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="remito-${id}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const company = process.env.COMPANY_NAME || 'Sistemas de Gestion';
    const companyExtra = process.env.COMPANY_ADDRESS || '';
    const margin = doc.page.margins.left;
    const rightMargin = doc.page.margins.right;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - margin - rightMargin;

    const fecha = new Date(h.fecha);
    const f = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    const cliente = `${h.cliente_nombre}${h.cliente_apellido ? ' ' + h.cliente_apellido : ''}`;

    const drawHLine = (y, color = '#0f172a') => {
      doc.moveTo(margin, y).lineTo(pageWidth - rightMargin, y).strokeColor(color).lineWidth(1).stroke();
    };

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(company, margin, margin);
    if (companyExtra) {
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(companyExtra, margin, doc.y + 2);
    }

    const boxWidth = 210;
    const boxHeight = 60;
    const boxX = pageWidth - rightMargin - boxWidth;
    const boxY = margin;
    doc.rect(boxX, boxY, boxWidth, boxHeight).strokeColor('#0f172a').lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text('Remito', boxX + 10, boxY + 8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a');
    doc.text(`Nro ${h.id}`, boxX + 10, boxY + 20);
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text(`Fecha: ${f}`, boxX + 10, boxY + 40);

    doc.y = Math.max(doc.y, boxY + boxHeight) + 10;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Remito de entrega', margin, doc.y);
    drawHLine(doc.y + 6, '#94a3b8');
    doc.moveDown(1);

    // Info table
    const infoTop = doc.y + 4;
    const infoHeight = 60;
    const colWidth = contentWidth / 2;
    doc.rect(margin, infoTop, contentWidth, infoHeight).strokeColor('#cbd5e1').lineWidth(1).stroke();
    doc.moveTo(margin + colWidth, infoTop).lineTo(margin + colWidth, infoTop + infoHeight).strokeColor('#cbd5e1').stroke();
    doc.moveTo(margin, infoTop + infoHeight / 2).lineTo(margin + contentWidth, infoTop + infoHeight / 2).strokeColor('#cbd5e1').stroke();

    doc.font('Helvetica').fontSize(9).fillColor('#64748b');
    doc.text('Cliente', margin + 8, infoTop + 6);
    doc.text('Fecha', margin + colWidth + 8, infoTop + 6);
    doc.text('Estado entrega', margin + 8, infoTop + infoHeight / 2 + 6);
    doc.text('Estado pago', margin + colWidth + 8, infoTop + infoHeight / 2 + 6);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
    doc.text(cliente, margin + 8, infoTop + 18, { width: colWidth - 16 });
    doc.text(f, margin + colWidth + 8, infoTop + 18, { width: colWidth - 16 });
    doc.text(h.estado_entrega || 'pendiente', margin + 8, infoTop + infoHeight / 2 + 18, { width: colWidth - 16 });
    doc.text(h.estado_pago || 'pendiente', margin + colWidth + 8, infoTop + infoHeight / 2 + 18, { width: colWidth - 16 });

    doc.y = infoTop + infoHeight + 16;

    if (observaciones) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Observaciones');
      doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(observaciones, {
        width: contentWidth,
      });
      doc.moveDown(0.6);
    }

    // Separator before details
    const sepY = doc.y;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('X', margin, sepY);
    doc.moveTo(margin + 16, sepY + 8).lineTo(pageWidth - rightMargin, sepY + 8).strokeColor('#0f172a').lineWidth(1).stroke();
    doc.y = sepY + 18;

    // Table header
    const tableX = margin;
    const tableWidth = contentWidth;
    const colWidths = [70, tableWidth - 70 - 90 - 90, 90, 90];
    const colX = [
      tableX,
      tableX + colWidths[0],
      tableX + colWidths[0] + colWidths[1],
      tableX + colWidths[0] + colWidths[1] + colWidths[2],
      tableX + tableWidth,
    ];

    const drawTableHeader = (y) => {
      doc.rect(tableX, y, tableWidth, 20).fill('#f1f5f9');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a');
      doc.text('Cantidad', colX[0] + 4, y + 5, { width: colWidths[0] - 8, align: 'center' });
      doc.text('Descripcion', colX[1] + 4, y + 5, { width: colWidths[1] - 8 });
      doc.text('P. Unit', colX[2] + 4, y + 5, { width: colWidths[2] - 8, align: 'right' });
      doc.text('Subtotal', colX[3] + 4, y + 5, { width: colWidths[3] - 8, align: 'right' });
      doc.rect(tableX, y, tableWidth, 20).strokeColor('#cbd5e1').lineWidth(1).stroke();
      return y + 20;
    };

    let y = drawTableHeader(doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a');

    let calcSubtotal = 0;
    for (const it of detalle.rows) {
      const cantidad = Number(it.cantidad) || 0;
      const unit = Number(it.precio_unitario) || 0;
      const sub = cantidad * unit;
      calcSubtotal += sub;

      const desc = String(it.producto_nombre || '');
      const descHeight = doc.heightOfString(desc, { width: colWidths[1] - 8 });
      const rowHeight = Math.max(18, descHeight + 6);

      if (y + rowHeight > pageHeight - doc.page.margins.bottom - 120) {
        doc.addPage();
        y = drawTableHeader(doc.y);
        doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
      }

      doc.text(String(cantidad), colX[0] + 4, y + 4, { width: colWidths[0] - 8, align: 'center' });
      doc.text(desc, colX[1] + 4, y + 4, { width: colWidths[1] - 8 });
      doc.text(`$ ${unit.toFixed(2)}`, colX[2] + 4, y + 4, { width: colWidths[2] - 8, align: 'right' });
      doc.text(`$ ${sub.toFixed(2)}`, colX[3] + 4, y + 4, { width: colWidths[3] - 8, align: 'right' });

      doc.moveTo(tableX, y + rowHeight).lineTo(tableX + tableWidth, y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
      doc.moveTo(colX[1], y).lineTo(colX[1], y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.6).stroke();
      doc.moveTo(colX[2], y).lineTo(colX[2], y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.6).stroke();
      doc.moveTo(colX[3], y).lineTo(colX[3], y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.6).stroke();

      y += rowHeight;
    }

    const totalsBoxWidth = 220;
    const totalsX = tableX + tableWidth - totalsBoxWidth;
    let totalsY = y + 14;
    if (totalsY + 80 > pageHeight - doc.page.margins.bottom) {
      doc.addPage();
      totalsY = doc.y;
    }
    doc.rect(totalsX, totalsY, totalsBoxWidth, 80).strokeColor('#0f172a').lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
    const lineH = 16;
    doc.text('Subtotal', totalsX + 10, totalsY + 8);
    doc.text(`$ ${calcSubtotal.toFixed(2)}`, totalsX + 10, totalsY + 8, { width: totalsBoxWidth - 20, align: 'right' });
    doc.text('Descuento', totalsX + 10, totalsY + 8 + lineH);
    doc.text(`$ ${(h.descuento || 0).toFixed(2)}`, totalsX + 10, totalsY + 8 + lineH, { width: totalsBoxWidth - 20, align: 'right' });
    doc.text('Impuestos', totalsX + 10, totalsY + 8 + lineH * 2);
    doc.text(`$ ${(h.impuestos || 0).toFixed(2)}`, totalsX + 10, totalsY + 8 + lineH * 2, { width: totalsBoxWidth - 20, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Total', totalsX + 10, totalsY + 8 + lineH * 3);
    doc.text(`$ ${(h.neto || h.total || 0).toFixed(2)}`, totalsX + 10, totalsY + 8 + lineH * 3, { width: totalsBoxWidth - 20, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#475569');
    doc.text('Documento generado por el sistema.', margin, totalsY + 90);

    doc.end();
  } catch (e) {
    console.error('[reportes] remitoPdf error', e);
    res.status(500).json({ error: 'No se pudo generar el PDF' });
  }
}
module.exports.remitoPdf = remitoPdf;
