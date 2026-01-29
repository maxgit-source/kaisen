const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ticketcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/tickets', auth, ctrl.list);
router.post('/tickets', auth, requireRole(['admin','gerente','vendedor']), ctrl.create);
router.put('/tickets/:id', auth, requireRole(['admin','gerente','vendedor']), ctrl.update);
router.get('/tickets/:id/eventos', auth, ctrl.listEventos);
router.post('/tickets/:id/eventos', auth, requireRole(['admin','gerente','vendedor']), ctrl.crearEvento);

module.exports = router;

