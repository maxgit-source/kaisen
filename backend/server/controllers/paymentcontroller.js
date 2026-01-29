const { body, validationResult } = require('express-validator');
const repo = require('../db/repositories/paymentRepository');

const validateCreate = [
  body('venta_id').optional({ nullable: true }).isInt({ gt: 0 }),
  body('cliente_id').isInt({ gt: 0 }),
  body('monto').isFloat({ gt: 0 }),
  body('metodo').optional().isIn(['efectivo', 'transferencia', 'tarjeta', 'otro']),
  body('fecha').optional().isISO8601(),
  body('fecha_limite').optional().isISO8601(),
];

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const r = await repo.crearPago(req.body);
    res.status(201).json(r);
  } catch (e) {
    const code = e.status || 500;
    res.status(code).json({ error: e.message || 'No se pudo registrar el pago' });
  }
}

async function list(req, res) {
  try {
    const rows = await repo.listarPagos({
      venta_id: req.query.venta_id,
      cliente_id: req.query.cliente_id,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener pagos' });
  }
}

module.exports = { create: [...validateCreate, create], list };
