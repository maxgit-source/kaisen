const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportcontroller');
const auth = require('../middlewares/authmiddleware');

router.get('/reportes/deudas', auth, ctrl.deudas);
router.get('/reportes/ganancias-mensuales', auth, ctrl.gananciasMensuales);
router.get('/reportes/movimientos', auth, ctrl.movimientos);
router.get('/reportes/ganancias', auth, ctrl.gananciasPdf);
router.get('/reportes/stock-bajo', auth, ctrl.stockBajo);
router.get('/reportes/top-clientes', auth, ctrl.topClientes);
router.get('/reportes/clientes/:id/top-productos', auth, ctrl.topProductosCliente);
// PDF remito de venta
router.get('/reportes/remito/:id.pdf', auth, ctrl.remitoPdf);

module.exports = router;
