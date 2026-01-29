const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/marketplacecontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Pymes aliadas
router.get('/marketplace/pymes', auth, requireRole(['admin', 'gerente']), ctrl.listPymes);
router.post('/marketplace/pymes', auth, requireRole(['admin', 'gerente']), ctrl.createPyme);
router.put('/marketplace/pymes/:id', auth, requireRole(['admin', 'gerente']), ctrl.updatePyme);

// Alianzas
router.get('/marketplace/alianzas', auth, requireRole(['admin', 'gerente']), ctrl.listAlianzas);
router.post('/marketplace/alianzas', auth, requireRole(['admin', 'gerente']), ctrl.createAlianza);
router.put('/marketplace/alianzas/:id', auth, requireRole(['admin', 'gerente']), ctrl.updateAlianza);

// Ofertas
router.get('/marketplace/alianzas/:id/ofertas', auth, requireRole(['admin', 'gerente']), ctrl.listOfertasByAlianza);
router.post('/marketplace/alianzas/:id/ofertas', auth, requireRole(['admin', 'gerente']), ctrl.createOferta);
router.put('/marketplace/ofertas/:id', auth, requireRole(['admin', 'gerente']), ctrl.updateOferta);

// Referidos
router.get('/marketplace/referidos', auth, requireRole(['admin', 'gerente']), ctrl.listReferidos);
router.post('/marketplace/referidos', auth, requireRole(['admin', 'gerente']), ctrl.createReferido);
router.put('/marketplace/referidos/:id', auth, requireRole(['admin', 'gerente']), ctrl.updateReferido);
router.post('/marketplace/referidos/validar', auth, requireRole(['admin', 'gerente', 'vendedor']), ctrl.validateReferido);

// Reportes
router.get('/marketplace/reportes/alianzas', auth, requireRole(['admin', 'gerente']), ctrl.reportAlianzas);

// Sync offline
router.get('/marketplace/sync/export', auth, requireRole(['admin', 'gerente']), ctrl.exportSync);
router.post('/marketplace/sync/import', auth, requireRole(['admin', 'gerente']), ctrl.importSync);

module.exports = router;
