const { check, validationResult } = require('express-validator');
const { withTransaction } = require('../db/pg');
const configRepo = require('../db/repositories/configRepository');
const audit = require('../services/auditService');
const net = require('net');

async function getDolarBlue(req, res) {
  try {
    const valor = await configRepo.getDolarBlue();
    res.json({
      clave: 'dolar_blue',
      valor: valor != null ? valor : null,
    });
  } catch (e) {
    console.error('Error obteniendo dolar_blue:', e);
    res.status(500).json({ error: 'No se pudo obtener el valor de dólar blue' });
  }
}

async function getDebtThreshold(req, res) {
  try {
    const valor = await configRepo.getDebtThreshold();
    res.json({
      clave: 'deuda_umbral_rojo',
      valor: valor != null ? valor : null,
    });
  } catch (e) {
    console.error('Error obteniendo deuda_umbral_rojo:', e);
    res.status(500).json({ error: 'No se pudo obtener el umbral de deuda' });
  }
}

const validateSetDolarBlue = [
  check('valor')
    .notEmpty()
    .withMessage('valor es requerido')
    .isFloat({ gt: 0 })
    .withMessage('valor debe ser un número mayor a 0'),
];

const validateSetDebtThreshold = [
  check('valor')
    .notEmpty()
    .withMessage('valor es requerido')
    .isFloat({ gt: 0 })
    .withMessage('valor debe ser un nÃºmero mayor a 0'),
];

async function setDolarBlueHandler(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({ error: 'Valor de dólar inválido' });
  }

  const usuarioId =
    req.user?.sub && Number.isFinite(Number(req.user.sub))
      ? Number(req.user.sub)
      : null;

  try {
    await withTransaction(async (client) => {
      // 1) Actualizar parámetro de sistema
      await client.query(
        `INSERT INTO parametros_sistema(clave, valor_num, usuario_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (clave) DO UPDATE
           SET valor_num = EXCLUDED.valor_num,
               usuario_id = EXCLUDED.usuario_id,
               actualizado_en = NOW()`,
        ['dolar_blue', valor, usuarioId || null]
      );

      // 2) Recalcular precios de todos los productos activos en base al costo en USD
      //    Solo para productos con costo en dólares > 0
      await client.query(
        `UPDATE productos
            SET tipo_cambio = $1,
                precio_costo = ROUND(precio_costo_dolares * $1, 2),
                precio_costo_pesos = ROUND(precio_costo_dolares * $1, 2),
                precio_local = ROUND(precio_costo_dolares * $1 * (1 + margen_local), 2),
                precio_distribuidor = ROUND(precio_costo_dolares * $1 * (1 + margen_distribuidor), 2),
                precio_venta = ROUND(precio_costo_dolares * $1 * (1 + margen_local), 2),
                actualizado_en = CURRENT_TIMESTAMP
          WHERE activo = TRUE
            AND precio_costo_dolares > 0`
        ,
        [valor]
      );

      // 3) Registrar historial de precios para trazabilidad
      await client.query(
        `INSERT INTO productos_historial(
           producto_id,
           proveedor_id,
           costo_pesos,
           costo_dolares,
           tipo_cambio,
           margen_local,
           margen_distribuidor,
           precio_local,
           precio_distribuidor,
           usuario_id
         )
         SELECT
           p.id,
           p.proveedor_id,
           ROUND(p.precio_costo_dolares * $1, 2) AS costo_pesos,
           p.precio_costo_dolares AS costo_dolares,
           $1 AS tipo_cambio,
           p.margen_local,
           p.margen_distribuidor,
           ROUND(p.precio_costo_dolares * $1 * (1 + p.margen_local), 2) AS precio_local,
           ROUND(p.precio_costo_dolares * $1 * (1 + p.margen_distribuidor), 2) AS precio_distribuidor,
           $2 AS usuario_id
         FROM productos p
         WHERE p.activo = TRUE
           AND p.precio_costo_dolares > 0`,
        [valor, usuarioId || null]
      );
    });

    res.json({
      clave: 'dolar_blue',
      valor,
      message: 'Dólar blue actualizado y precios recalculados',
    });
  } catch (e) {
    console.error('Error guardando dolar_blue y recalculando precios:', e);
    res
      .status(500)
      .json({ error: 'No se pudo guardar el valor de dólar blue ni recalcular precios' });
  }
}

async function setDebtThresholdHandler(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({ error: 'Umbral de deuda invalido' });
  }

  const usuarioId =
    req.user?.sub && Number.isFinite(Number(req.user.sub))
      ? Number(req.user.sub)
      : null;

  try {
    await configRepo.setDebtThreshold(valor, usuarioId);
    res.json({
      clave: 'deuda_umbral_rojo',
      valor,
      message: 'Umbral de deuda actualizado',
    });
  } catch (e) {
    console.error('Error guardando deuda_umbral_rojo:', e);
    res.status(500).json({ error: 'No se pudo guardar el umbral de deuda' });
  }
}

module.exports = {
  getDolarBlue,
  setDolarBlue: [...validateSetDolarBlue, setDolarBlueHandler],
  getDebtThreshold,
  setDebtThreshold: [...validateSetDebtThreshold, setDebtThresholdHandler],
  getNetworkPolicy: getNetworkPolicyHandler,
  setNetworkPolicy: setNetworkPolicyHandler,
  resetPanelData: resetPanelDataHandler,
};

async function resetPanelDataHandler(req, res) {
  const usuarioId =
    (req.authUser && req.authUser.id) ||
    (req.user?.sub && Number.isFinite(Number(req.user.sub))
      ? Number(req.user.sub)
      : null);

  try {
      await withTransaction(async (client) => {
        const tables = [
          'logs',
          'crm_actividades',
          'crm_oportunidades',
          'ticket_eventos',
          'tickets',
          'aprobaciones_historial',
          'aprobaciones',
          'productos_historial',
          'producto_imagenes',
          'movimientos_stock',
          'stock_ajustes',
          'inventario_depositos',
          'compras_detalle',
          'recepciones_detalle',
          'recepciones',
          'compras',
          'ventas_detalle',
          'pagos',
          'facturas',
          'ventas',
          'gastos',
          'inversiones',
          'pagos_proveedores',
          'proveedores',
          'categorias',
          'productos',
          'clientes_deudas_iniciales_pagos',
          'clientes_deudas_iniciales',
          'clientes_refresh_tokens',
          'clientes_auth',
          'clientes',
          'OrderItems',
          'Orders',
          'Products',
        ];
        for (const table of tables) {
          await client.query(`DELETE FROM ${table}`);
        }
        await client.query('DELETE FROM sqlite_sequence');
      });

    await audit.log({
      usuario_id: usuarioId || null,
      accion: 'reset_datos_panel',
      tabla_afectada: '*',
      registro_id: null,
      descripcion:
        'Limpieza manual de datos del panel (clientes, productos, ventas, etc.)',
    });

    res.json({
      message:
        'Datos del panel limpiados correctamente. Usuarios y login se mantienen intactos.',
    });
  } catch (e) {
    console.error('Error reseteando datos del panel:', e);
    res
      .status(500)
      .json({ error: 'No se pudieron limpiar los datos del panel' });
  }
}

async function getNetworkPolicyHandler(req, res) {
  try {
    const policy = (await configRepo.getNetworkPolicy()) || 'off';
    const subnet = await configRepo.getNetworkSubnet();
    res.json({ policy, subnet: subnet || null });
  } catch (e) {
    console.error('Error obteniendo politica de red:', e);
    res.status(500).json({ error: 'No se pudo obtener la politica de red' });
  }
}

async function setNetworkPolicyHandler(req, res) {
  const policy = String(req.body?.policy || '').trim().toLowerCase();
  const subnet = req.body?.subnet ? String(req.body.subnet).trim() : null;
  const allowed = new Set(['off', 'private', 'subnet']);
  if (!allowed.has(policy)) {
    return res.status(400).json({ error: 'Politica invalida' });
  }
  if (policy === 'subnet') {
    if (!subnet || !/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(subnet)) {
      return res.status(400).json({ error: 'Subnet invalida. Ej: 192.168.0.0/24' });
    }
    const [ip, prefix] = subnet.split('/');
    if (net.isIP(ip) !== 4 || Number(prefix) < 0 || Number(prefix) > 32) {
      return res.status(400).json({ error: 'Subnet invalida. Ej: 192.168.0.0/24' });
    }
  }
  const usuarioId =
    req.user?.sub && Number.isFinite(Number(req.user.sub))
      ? Number(req.user.sub)
      : null;
  try {
    await configRepo.setNetworkPolicy(policy, usuarioId);
    if (policy === 'subnet') {
      await configRepo.setNetworkSubnet(subnet, usuarioId);
    } else {
      await configRepo.setNetworkSubnet(null, usuarioId);
    }
    res.json({ policy, subnet: policy === 'subnet' ? subnet : null });
  } catch (e) {
    console.error('Error guardando politica de red:', e);
    res.status(500).json({ error: 'No se pudo guardar la politica de red' });
  }
}
