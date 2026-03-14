const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchasecontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const {
  requireDepositoAccessFromBody,
} = require('../middlewares/depositoAccessMiddleware');
const { uploadSingle } = require('../middlewares/uploadMiddleware');
const { uploadLimiter } = require('../middlewares/security');

router.get('/compras', auth, ctrl.list);
router.post(
  '/compras/importar-excel',
  uploadLimiter,
  auth,
  requireRole(['admin', 'gerente']),
  uploadSingle('file'),
  ctrl.importExcel
);
router.post('/compras', auth, requireRole(['admin','gerente']), ctrl.create);
router.get('/compras/:id/detalle', auth, ctrl.detalle);
router.post(
  '/compras/:id/recibir',
  auth,
  requireRole(['admin','gerente']),
  requireDepositoAccessFromBody(['deposito_id']),
  ctrl.recibir,
);

module.exports = router;
