const { withTransaction, query } = require('../../db/pg');
const inv = require('../../services/inventoryService');
const marketplaceService = require('../../services/marketplaceService');

async function createVenta({
  cliente_id,
  fecha,
  descuento = 0,
  impuestos = 0,
  items = [],
  deposito_id,
  es_reserva = false,
  usuario_id = null,
  referido_codigo,
}) {
  return withTransaction(async (client) => {
    // Validate cliente
    const c = await client.query('SELECT id, estado FROM clientes WHERE id = $1', [cliente_id]);
    if (!c.rowCount) {
      const e = new Error('Cliente no encontrado');
      e.status = 400;
      throw e;
    }
    const cliente = c.rows[0];
    if (cliente.estado !== 'activo') {
      const e = new Error('El cliente est\u00e1 inactivo');
      e.status = 400;
      throw e;
    }
    // Load and lock inventory for items
    const ids = items.map((i) => Number(i.producto_id));
    if (!ids.length) {
      const e = new Error('Debe incluir items');
      e.status = 400;
      throw e;
    }
    const uniqueIds = Array.from(
      new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
    );
    if (!uniqueIds.length) {
      const e = new Error('Debe incluir items');
      e.status = 400;
      throw e;
    }
    const productPlaceholders = uniqueIds.map((_, idx) => `$${idx + 1}`).join(', ');
    const { rows: products } = await client.query(
      `SELECT p.id, p.nombre, p.precio_venta::float AS price
         FROM productos p
        WHERE p.id IN (${productPlaceholders})`,
      uniqueIds
    );
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[ventas] productos solicitados', ids);
        console.debug('[ventas] productos encontrados', products.map((p) => p.id));
      }
    } catch {}
    const byId = new Map(products.map((p) => [Number(p.id), p]));
    const isReserva = Boolean(es_reserva);

    // Calculate totals (validación de stock se hará al momento de entrega)
    let total = 0;
    for (const it of items) {
      const p = byId.get(Number(it.producto_id));
      if (!p) { const e = new Error(`Producto ${it.producto_id} inexistente`); e.status = 400; throw e; }
      const qty = Number(it.cantidad) || 0;
      const unitPrice = Number(it.precio_unitario) || p.price;
      total += unitPrice * qty;
    }
    const baseDescuento = Number(descuento) || 0;
    const baseImpuestos = Number(impuestos) || 0;

    let referidoInfo = null;
    let referidoDescuento = 0;
    let referidoComision = 0;
    if (referido_codigo) {
      referidoInfo = await marketplaceService.resolveReferido({
        codigo: referido_codigo,
        total,
        client,
      });
      referidoDescuento = Number(referidoInfo.descuento_aplicado || 0);
      referidoComision = Number(referidoInfo.comision_monto || 0);
    }

    const neto = total - baseDescuento - referidoDescuento + baseImpuestos;

    const resolvedDepositoId = await inv.resolveDepositoId(client, deposito_id);

    if (!isReserva) {
      const placeholders = uniqueIds.map((_, idx) => `$${idx + 2}`).join(', ');
      const { rows: invRows } = await client.query(
        `SELECT producto_id, cantidad_disponible
           FROM inventario_depositos
          WHERE deposito_id = $1 AND producto_id IN (${placeholders})`,
        [resolvedDepositoId, ...uniqueIds]
      );
      const invById = new Map(
        invRows.map((r) => [Number(r.producto_id), Number(r.cantidad_disponible || 0)])
      );
      for (const it of items) {
        const qty = Number(it.cantidad) || 0;
        const prodId = Number(it.producto_id);
        const available = invById.has(prodId) ? Number(invById.get(prodId) || 0) : 0;
        if (available < qty) {
          const e = new Error(
            `Stock insuficiente para producto ${prodId} (disp ${available}, req ${qty}). Usa reserva si corresponde.`
          );
          e.status = 409;
          throw e;
        }
      }
    }

    const insVenta = await client.query(
      `INSERT INTO ventas(cliente_id, fecha, total, descuento, impuestos, neto, estado_pago, deposito_id, es_reserva, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', $7, $8, $9) RETURNING id`,
      [cliente_id, fecha || new Date(), total, baseDescuento, baseImpuestos, neto, resolvedDepositoId, isReserva ? 1 : 0, usuario_id]
    );
    const ventaId = insVenta.rows[0].id;

    for (const it of items) {
      const p = byId.get(Number(it.producto_id));
      const qty = Number(it.cantidad) || 0;
      const unitPrice = Number(it.precio_unitario) || p.price;
      await client.query(
        `INSERT INTO ventas_detalle(venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [ventaId, Number(p.id), qty, unitPrice, unitPrice * qty]
      );
    }

    if (referidoInfo) {
      const newUsos = Number(referidoInfo.usos_actuales || 0) + 1;
      await client.query(
        `UPDATE referidos
            SET usos_actuales = $2,
                estado = CASE WHEN $3 > 0 AND $2 >= $3 THEN 'agotado' ELSE estado END,
                actualizado_en = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [referidoInfo.referido_id, newUsos, Number(referidoInfo.max_usos || 0)]
      );
      await client.query(
        `INSERT INTO uso_referidos(
           referido_id, venta_id, total_venta, descuento_aplicado, comision_monto, usuario_id, notas
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          referidoInfo.referido_id,
          ventaId,
          total,
          referidoDescuento,
          referidoComision,
          usuario_id,
          `codigo:${referidoInfo.codigo}`,
        ]
      );
    }

    return { id: ventaId, total, neto };
  });
}

async function listarVentas({ cliente_id, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];

  if (cliente_id != null) {
    const cid = Number(cliente_id);
    if (Number.isInteger(cid) && cid > 0) {
      params.push(cid);
      where.push(`v.cliente_id = $${params.length}`);
    }
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim);
  params.push(off);

  const sql = `SELECT v.id, v.cliente_id, c.nombre AS cliente_nombre, v.fecha, v.usuario_id,
                      v.total::float AS total, v.descuento::float AS descuento, v.impuestos::float AS impuestos,
                      v.neto::float AS neto, v.estado_pago, v.estado_entrega, v.observaciones, v.oculto, v.es_reserva,
                      COALESCE(p.total_pagado, 0)::float AS total_pagado,
                      (v.neto - COALESCE(p.total_pagado, 0))::float AS saldo_pendiente
                 FROM ventas v
                 JOIN clientes c ON c.id = v.cliente_id
            LEFT JOIN (
                      SELECT venta_id, SUM(monto) AS total_pagado
                        FROM pagos
                       GROUP BY venta_id
                     ) p ON p.venta_id = v.id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY v.id DESC
                LIMIT $${params.length - 1}
               OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

async function getVentaDetalle(id) {
  const { rows } = await query(
    `SELECT d.id, d.producto_id, p.nombre AS producto_nombre, d.cantidad, d.precio_unitario::float AS precio_unitario, d.subtotal::float AS subtotal
       FROM ventas_detalle d
       JOIN productos p ON p.id = d.producto_id
      WHERE d.venta_id = $1`,
    [id]
  );
  return rows;
}

module.exports = { createVenta, listarVentas, getVentaDetalle };
 
async function entregarVenta(id) {
  return withTransaction(async (client) => {
    const v = await client.query('SELECT id, estado_entrega, deposito_id FROM ventas WHERE id = $1', [id]);
    if (!v.rowCount) { const e = new Error('Venta no encontrada'); e.status = 404; throw e; }
    const venta = v.rows[0];
    if (venta.estado_entrega === 'entregado') { const e = new Error('La venta ya está entregada'); e.status = 400; throw e; }
    const { rows: items } = await client.query(
      `SELECT producto_id, cantidad, precio_unitario FROM ventas_detalle WHERE venta_id = $1 ORDER BY id ASC`,
      [id]
    );
    for (const it of items) {
      await inv.removeStockTx(client, {
        producto_id: Number(it.producto_id),
        cantidad: Number(it.cantidad),
        motivo: 'venta_entrega',
        referencia: `VENTA ${id}`,
        deposito_id: venta.deposito_id,
      });
    }
    await client.query("UPDATE ventas SET estado_entrega = 'entregado', fecha_entrega = NOW() WHERE id = $1", [id]);
    return { id, entregado: true };
  });
}

module.exports.entregarVenta = entregarVenta;

async function setOculto(id, oculto = true) {
  const { rows } = await query(
    'UPDATE ventas SET oculto = $2 WHERE id = $1 RETURNING id',
    [id, oculto]
  );
  return rows[0] || null;
}

module.exports.setOculto = setOculto;

async function cancelarVenta(id, motivo) {
  const { rows } = await query(
    'SELECT id, estado_entrega, estado_pago, observaciones FROM ventas WHERE id = $1',
    [id]
  );
  if (!rows.length) {
    const e = new Error('Venta no encontrada');
    e.status = 404;
    throw e;
  }
  const venta = rows[0];
  if (venta.estado_entrega === 'entregado') {
    const e = new Error('No se puede cancelar una venta entregada');
    e.status = 400;
    throw e;
  }
  if (venta.estado_pago === 'cancelado') {
    return { id, cancelado: true };
  }
  const motivoTexto = (motivo || '').trim() || 'Cancelado por el usuario';
  const nuevaObs =
    venta.observaciones && venta.observaciones.trim()
      ? `${venta.observaciones} | ${motivoTexto}`
      : motivoTexto;
  await query(
    `UPDATE ventas
        SET estado_pago = 'cancelado',
            observaciones = $2
      WHERE id = $1`,
    [id, nuevaObs]
  );
  return { id, cancelado: true };
}

module.exports.cancelarVenta = cancelarVenta;
