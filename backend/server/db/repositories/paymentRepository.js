const { withTransaction, query } = require('../../db/pg');

async function crearPago({ venta_id, cliente_id, monto, fecha, metodo = 'efectivo', fecha_limite = null }) {
  return withTransaction(async (client) => {
    const ventaId = venta_id ? Number(venta_id) : null;
    if (ventaId) {
      const v = await client.query('SELECT id, neto, estado_pago, cliente_id FROM ventas WHERE id = $1', [ventaId]);
      if (!v.rowCount) {
        const e = new Error('Venta no encontrada');
        e.status = 404;
        throw e;
      }
      const venta = v.rows[0];
      if (Number(venta.cliente_id) !== Number(cliente_id)) {
        const e = new Error('La venta no pertenece al cliente');
        e.status = 400;
        throw e;
      }
      // Insert pago asociado a venta
      await client.query(
        `INSERT INTO pagos(venta_id, cliente_id, monto, fecha, metodo, fecha_limite)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ventaId, cliente_id, monto, fecha || new Date(), metodo, fecha_limite || null]
      );
      // Recalcular total pagado
      const { rows } = await client.query('SELECT COALESCE(SUM(monto),0)::float AS total FROM pagos WHERE venta_id = $1', [ventaId]);
      const totalPagado = rows[0].total;
      if (totalPagado >= Number(venta.neto)) {
        await client.query("UPDATE ventas SET estado_pago = 'pagada' WHERE id = $1", [ventaId]);
      }
      return { venta_id: ventaId, total_pagado: totalPagado };
    }

    await client.query(
      `INSERT INTO pagos(venta_id, cliente_id, monto, fecha, metodo, fecha_limite)
       VALUES (NULL, $1, $2, $3, $4, $5)`,
      [cliente_id, monto, fecha || new Date(), metodo, fecha_limite || null]
    );
    return { venta_id: null, cliente_id, monto };
  });
}

async function listarPagos({ venta_id, cliente_id, limit = 100, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (venta_id) { params.push(venta_id); where.push(`venta_id = $${params.length}`); }
  if (cliente_id) { params.push(cliente_id); where.push(`cliente_id = $${params.length}`); }
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim); params.push(off);
  const { rows } = await query(
    `SELECT id, venta_id, cliente_id, monto::float AS monto, fecha, metodo, fecha_limite
       FROM pagos
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    'SELECT id, venta_id, cliente_id, monto::float AS monto FROM pagos WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function eliminarPago(id) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, venta_id, cliente_id FROM pagos WHERE id = $1',
      [id]
    );
    if (!rows.length) return null;
    const pago = rows[0];
    await client.query('DELETE FROM pagos WHERE id = $1', [id]);
    if (pago.venta_id) {
      const { rows: totalRows } = await client.query(
        'SELECT COALESCE(SUM(monto),0)::float AS total FROM pagos WHERE venta_id = $1',
        [pago.venta_id]
      );
      const totalPagado = Number(totalRows[0]?.total || 0);
      const { rows: ventaRows } = await client.query(
        'SELECT neto::float AS neto FROM ventas WHERE id = $1',
        [pago.venta_id]
      );
      if (ventaRows.length) {
        const neto = Number(ventaRows[0]?.neto || 0);
        const nuevoEstado = totalPagado >= neto ? 'pagada' : 'pendiente';
        await client.query('UPDATE ventas SET estado_pago = $2 WHERE id = $1', [
          pago.venta_id,
          nuevoEstado,
        ]);
      }
    }
    return { id: pago.id, venta_id: pago.venta_id, cliente_id: pago.cliente_id };
  });
}

module.exports = { crearPago, listarPagos, findById, eliminarPago };
