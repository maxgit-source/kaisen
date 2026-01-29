const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/catalogcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Catálogo público
router.get('/catalogo', ctrl.getCatalogPublic);

// Configuración de catálogo (admin)
router.get('/catalogo/config', auth, requireRole(['admin', 'gerente']), ctrl.getCatalogConfig);
router.put('/catalogo/config', auth, requireRole(['admin', 'gerente']), ctrl.updateCatalogConfig);
router.get('/catalogo/excel', auth, requireRole(['admin', 'gerente']), ctrl.exportCatalogExcel);

module.exports = router;
