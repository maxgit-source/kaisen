const { check, validationResult } = require('express-validator');
const cloudIdentity = require('../services/cloudIdentityService');
const catalogSnapshot = require('../services/catalogSnapshotService');
const syncQueue = require('../db/repositories/syncQueueRepository');

const validateActivate = [
  check('token').notEmpty().withMessage('token requerido'),
  check('endpoint').optional().isString().isLength({ max: 300 }),
];

async function status(req, res) {
  try {
    const usuarioId = req.user?.sub ? Number(req.user.sub) : null;
    const data = await cloudIdentity.getStatus({ usuarioId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener el estado cloud' });
  }
}

async function activate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const usuarioId = req.user?.sub ? Number(req.user.sub) : null;
    const data = await cloudIdentity.activate({
      token: req.body.token,
      endpoint: req.body.endpoint,
      usuarioId,
    });
    res.json({ message: 'Vinculacion cloud guardada', cloud: data });
  } catch (err) {
    const code = err.status || 500;
    res.status(code).json({ error: err.message || 'No se pudo activar cloud' });
  }
}

module.exports = {
  status,
  activate: [...validateActivate, activate],
  snapshot: async (req, res) => {
    try {
      const usuarioId = req.user?.sub ? Number(req.user.sub) : null;
      await catalogSnapshot.enqueueFullSnapshot(usuarioId);
      res.json({ ok: true, message: 'Snapshot encolado' });
    } catch (err) {
      console.error('Cloud snapshot error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'No se pudo generar snapshot' });
    }
  },
  queueStatus: async (_req, res) => {
    try {
      const data = await syncQueue.getStatusSummary();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'No se pudo obtener estado de sync' });
    }
  },
};
