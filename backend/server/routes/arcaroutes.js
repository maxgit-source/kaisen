const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/arcacontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/arca/config', auth, requireRole(['admin', 'gerente']), ctrl.getConfig);
router.put('/arca/config', auth, requireRole(['admin', 'gerente']), ctrl.setConfig);
router.post('/arca/test', auth, requireRole(['admin', 'gerente']), ctrl.testConnection);

router.get('/arca/puntos-venta', auth, requireRole(['admin', 'gerente']), ctrl.listPuntosVenta);
router.post('/arca/puntos-venta', auth, requireRole(['admin', 'gerente']), ctrl.createPuntoVenta);
router.put('/arca/puntos-venta/:id', auth, requireRole(['admin', 'gerente']), ctrl.updatePuntoVenta);
router.delete('/arca/puntos-venta/:id', auth, requireRole(['admin', 'gerente']), ctrl.deletePuntoVenta);

router.post('/arca/puntos-venta/asignar', auth, requireRole(['admin', 'gerente']), ctrl.asignarDeposito);
router.get('/arca/depositos', auth, requireRole(['admin', 'gerente']), ctrl.listDepositos);

router.post('/arca/clientes/:id/padron', auth, requireRole(['admin', 'gerente', 'vendedor']), ctrl.padronCliente);

router.get('/arca/facturas/:ventaId', auth, requireRole(['admin', 'gerente', 'vendedor']), ctrl.getFactura);
router.get('/arca/facturas/:ventaId/pdf', auth, requireRole(['admin', 'gerente', 'vendedor']), ctrl.facturaPdf);

router.post('/arca/emitir', auth, requireRole(['admin', 'gerente', 'vendedor']), ctrl.emitirFactura);

module.exports = router;

