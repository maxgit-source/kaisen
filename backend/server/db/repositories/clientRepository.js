const { query } = require('../../db/pg');

async function list({
  q,
  estado,
  tipo_cliente,
  segmento,
  limit = 50,
  offset = 0,
  allowAll = false,
  view,
  includeDeleted = false,
  onlyDeleted = false,
} = {}) {
  const where = [];
  const params = [];
  if (onlyDeleted) where.push('deleted_at IS NOT NULL');
  else if (!includeDeleted) where.push('deleted_at IS NULL');
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(
      `(LOWER(nombre) LIKE $${params.length} OR LOWER(apellido) LIKE $${params.length} OR LOWER(CONCAT(nombre, ' ', COALESCE(apellido, ''))) LIKE $${params.length})`
    );
  }
  if (estado) {
    params.push(estado);
    where.push(`estado = $${params.length}`);
  }
  if (tipo_cliente) {
    params.push(tipo_cliente);
    where.push(`tipo_cliente = $${params.length}`);
  }
  if (segmento) {
    params.push(segmento);
    where.push(`segmento = $${params.length}`);
  }
  const maxLimit = allowAll ? 10000 : 200;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), maxLimit);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  params.push(lim);
  params.push(off);
  const viewMode = String(view || '').trim().toLowerCase();
  const selectColumns =
    viewMode === 'mobile'
      ? `id, nombre, apellido, telefono, telefono_e164, whatsapp_opt_in, whatsapp_opt_in_at,
         whatsapp_status, whatsapp_last_error, email, direccion, entre_calles, cuit_cuil,
         tipo_doc, nro_doc, condicion_iva, domicilio_fiscal, provincia, localidad, codigo_postal,
         zona_id, estado, tipo_cliente, segmento, tags, deleted_at`
      : `id, nombre, apellido, telefono, telefono_e164, whatsapp_opt_in, whatsapp_opt_in_at,
         whatsapp_status, whatsapp_last_error, email, direccion, entre_calles, cuit_cuil,
         tipo_doc, nro_doc, condicion_iva, domicilio_fiscal, provincia, localidad, codigo_postal,
         zona_id, fecha_registro, estado, tipo_cliente, segmento, tags, deleted_at`;

  const sql = `SELECT ${selectColumns}
                 FROM clientes
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY id DESC
                LIMIT $${params.length - 1}
               OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows;
}

async function create({
  nombre,
  apellido,
  telefono,
  telefono_e164,
  whatsapp_opt_in = 0,
  whatsapp_opt_in_at,
  whatsapp_status = 'unknown',
  whatsapp_last_error,
  email,
  direccion,
  entre_calles,
  cuit_cuil,
  tipo_doc,
  nro_doc,
  condicion_iva,
  domicilio_fiscal,
  provincia,
  localidad,
  codigo_postal,
  zona_id,
  estado = 'activo',
  tipo_cliente = 'minorista',
  segmento = null,
  tags = null,
}) {
  const { rows } = await query(
    `INSERT INTO clientes(
        nombre, apellido, telefono, telefono_e164, whatsapp_opt_in, whatsapp_opt_in_at, whatsapp_status, whatsapp_last_error,
        email, direccion, entre_calles, cuit_cuil,
        tipo_doc, nro_doc, condicion_iva, domicilio_fiscal, provincia, localidad, codigo_postal,
        zona_id, estado, tipo_cliente, segmento, tags, deleted_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NULL)
     RETURNING id`,
    [
      nombre,
      apellido || null,
      telefono || null,
      telefono_e164 || null,
      whatsapp_opt_in ? 1 : 0,
      whatsapp_opt_in_at || null,
      whatsapp_status || 'unknown',
      whatsapp_last_error || null,
      email || null,
      direccion || null,
      entre_calles || null,
      cuit_cuil || null,
      tipo_doc || null,
      nro_doc || null,
      condicion_iva || null,
      domicilio_fiscal || null,
      provincia || null,
      localidad || null,
      codigo_postal || null,
      zona_id || null,
      estado,
      tipo_cliente || 'minorista',
      segmento || null,
      tags || null,
    ]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, estado
       FROM clientes
      WHERE LOWER(email) = LOWER($1)
        AND deleted_at IS NULL
      LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT id, nombre, apellido, email, estado, deleted_at
       FROM clientes
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  let p = 1;
  for (const [key, col] of Object.entries({
    nombre: 'nombre',
    apellido: 'apellido',
    telefono: 'telefono',
    telefono_e164: 'telefono_e164',
    whatsapp_opt_in: 'whatsapp_opt_in',
    whatsapp_opt_in_at: 'whatsapp_opt_in_at',
    whatsapp_status: 'whatsapp_status',
    whatsapp_last_error: 'whatsapp_last_error',
    email: 'email',
    direccion: 'direccion',
    entre_calles: 'entre_calles',
    cuit_cuil: 'cuit_cuil',
    tipo_doc: 'tipo_doc',
    nro_doc: 'nro_doc',
    condicion_iva: 'condicion_iva',
    domicilio_fiscal: 'domicilio_fiscal',
    provincia: 'provincia',
    localidad: 'localidad',
    codigo_postal: 'codigo_postal',
    zona_id: 'zona_id',
    estado: 'estado',
    tipo_cliente: 'tipo_cliente',
    segmento: 'segmento',
    tags: 'tags',
    deleted_at: 'deleted_at',
  })) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = $${p++}`);
      params.push(fields[key] ?? null);
    }
  }
  if (!sets.length) return { id };
  params.push(id);
  const { rows } = await query(
    `UPDATE clientes
        SET ${sets.join(', ')}
      WHERE id = $${p}
        AND deleted_at IS NULL
      RETURNING id`,
    params
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rows } = await query(
    'SELECT estado, deleted_at FROM clientes WHERE id = $1 LIMIT 1',
    [id]
  );
  if (!rows.length) {
    return null;
  }
  const current = rows[0];
  if (current.deleted_at) {
    return { id };
  }
  if (current.estado !== 'inactivo') {
    const e = new Error('El cliente debe estar inactivo antes de poder eliminarlo');
    e.status = 400;
    e.code = 'CLIENTE_DEBE_INACTIVARSE';
    throw e;
  }

  // Calcular deuda pendiente usando la vista_deudas
  const { rows: deudaRows } = await query(
    'SELECT deuda_pendiente FROM vista_deudas WHERE cliente_id = $1',
    [id]
  );
  const deudaPendiente =
    deudaRows.length && deudaRows[0].deuda_pendiente != null
      ? Number(deudaRows[0].deuda_pendiente)
      : 0;

  if (deudaPendiente > 0.0001) {
    const e = new Error(
      `No se puede eliminar el cliente porque tiene una deuda pendiente de $${deudaPendiente.toFixed(
        2
      )}`
    );
    e.status = 400;
    e.code = 'CLIENTE_CON_DEUDA';
    e.deudaPendiente = deudaPendiente;
    throw e;
  }

  const deleted = await query(
    `UPDATE clientes
        SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id`,
    [id]
  );
  return deleted.rows[0] || null;
}

async function restore(id) {
  const { rows } = await query(
    `UPDATE clientes
        SET deleted_at = NULL,
            estado = CASE WHEN estado = 'inactivo' THEN 'activo' ELSE estado END
      WHERE id = $1
        AND deleted_at IS NOT NULL
      RETURNING id`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Historial unificado de pagos de un cliente:
 * pagos de ventas, pagos de cuenta, pagos de deudas iniciales y entregas.
 *
 * Query en MySQL puro — no mezclar sintaxis SQLite/PostgreSQL aquí.
 */
async function listPaymentHistory(clienteId, { limit = 200, offset = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const { rows } = await query(
    `SELECT id, tipo, venta_id, monto, fecha, detalle
       FROM (
         SELECT
           p.id                                              AS id,
           CASE
             WHEN p.venta_id IS NULL THEN 'pago_cuenta'
             ELSE 'pago_venta'
           END                                              AS tipo,
           p.venta_id                                       AS venta_id,
           p.monto                                          AS monto,
           p.fecha                                          AS fecha,
           NULL                                             AS detalle
         FROM pagos p
         LEFT JOIN ventas v ON v.id = p.venta_id
        WHERE p.cliente_id = $1
          AND (p.venta_id IS NULL OR v.estado_pago <> 'cancelado')

         UNION ALL

         SELECT
           p.id                                             AS id,
           'pago_deuda_inicial'                             AS tipo,
           NULL                                             AS venta_id,
           p.monto                                          AS monto,
           p.fecha                                          AS fecha,
           p.descripcion                                    AS detalle
         FROM clientes_deudas_iniciales_pagos p
        WHERE p.cliente_id = $1

         UNION ALL

         SELECT
           v.id                                             AS id,
           'entrega_venta'                                  AS tipo,
           v.id                                             AS venta_id,
           NULL                                             AS monto,
           v.fecha_entrega                                  AS fecha,
           COALESCE(
             GROUP_CONCAT(
               CONCAT(pr.nombre, ' x', vd.cantidad)
               ORDER BY pr.nombre
               SEPARATOR ', '
             ),
             ''
           )                                               AS detalle
         FROM ventas v
         JOIN ventas_detalle vd ON vd.venta_id = v.id
         JOIN productos pr      ON pr.id = vd.producto_id
        WHERE v.cliente_id = $1
          AND v.estado_entrega = 'entregado'
        GROUP BY v.id, v.fecha_entrega
       ) AS historial
      ORDER BY (fecha IS NULL) ASC, fecha DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [clienteId, lim, off],
  );
  return rows;
}

module.exports = {
  list,
  create,
  update,
  remove,
  restore,
  findByEmail,
  findById,
  listPaymentHistory,
};
