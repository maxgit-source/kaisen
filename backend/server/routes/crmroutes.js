const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/crmcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Oportunidades
router.get('/crm/oportunidades', auth, ctrl.listOportunidades);
router.post('/crm/oportunidades', auth, requireRole(['admin','gerente','vendedor']), ctrl.crearOportunidad);
router.put('/crm/oportunidades/:id', auth, requireRole(['admin','gerente','vendedor']), ctrl.actualizarOportunidad);

// Actividades
router.get('/crm/actividades', auth, ctrl.listActividades);
router.post('/crm/actividades', auth, requireRole(['admin','gerente','vendedor']), ctrl.crearActividad);
router.put('/crm/actividades/:id', auth, requireRole(['admin','gerente','vendedor']), ctrl.actualizarActividad);

// Análisis CRM
router.get('/crm/analisis', auth, ctrl.analisis);

module.exports = router;
