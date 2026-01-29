const { query } = require('../db/pg');
const PDFDocument = require('pdfkit');

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

// PDF de ganancias para el período seleccionado
async function gananciasPdf(req, res) {
  try {
    const { desde, hasta, agregado } = req.query || {};
    const today = new Date();
    const defaultHasta = today;
    const defaultDesde = new Date(today);
    defaultDesde.setDate(defaultDesde.getDate() - 29);

    const fromDate = parseDateParam(desde, defaultDesde);
    const toDate = parseDateParam(hasta, defaultHasta);
    const agg = (agregado || 'dia').toString().toLowerCase();

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
        [fromDate.toISOString().slice(0, 10), toDate.toISOString().slice(0, 10)]
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
        [fromDate.toISOString().slice(0, 10), toDate.toISOString().slice(0, 10)]
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
    const fileName = `informe-ganancias-${fromDate.toISOString().slice(0, 10)}_a_${toDate
      .toISOString()
      .slice(0, 10)}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    const company = process.env.COMPANY_NAME || 'Sistemas de Gestión';
    const periodLabel = `${fromDate.toISOString().slice(0, 10)} a ${toDate
      .toISOString()
      .slice(0, 10)}`;

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

    doc.end();
  } catch (e) {
    console.error('[reportes] gananciasPdf error', e);
    res.status(500).json({ error: 'No se pudo generar el informe de ganancias' });
  }
}

module.exports = { deudas, gananciasMensuales, stockBajo, topClientes, topProductosCliente, movimientos, gananciasPdf };

// PDF Remito de entrega por venta
async function remitoPdf(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID invalido' });
    }

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
