const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/configcontroller');
const auth = require('../middlewares/authmiddleware');

// Configuración de parámetros del sistema
router.get('/config/dolar-blue', auth, ctrl.getDolarBlue);
router.put('/config/dolar-blue', auth, ctrl.setDolarBlue);
router.get('/config/deuda-umbral', auth, ctrl.getDebtThreshold);
router.put('/config/deuda-umbral', auth, ctrl.setDebtThreshold);
router.get('/config/network', auth, ctrl.getNetworkPolicy);
router.put('/config/network', auth, ctrl.setNetworkPolicy);

module.exports = router;
