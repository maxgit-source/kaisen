const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/approvalcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/aprobaciones', auth, requireRole(['admin','gerente']), ctrl.list);
router.post('/aprobaciones/:id/aprobar', auth, requireRole(['admin','gerente']), ctrl.aprobar);
router.post('/aprobaciones/:id/rechazar', auth, requireRole(['admin','gerente']), ctrl.rechazar);

module.exports = router;

