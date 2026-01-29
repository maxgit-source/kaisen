const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aicontroller');
const auth = require('../middlewares/authmiddleware');

router.get('/ai/forecast', auth, ctrl.forecast);
router.get('/ai/forecast/:id/serie', auth, ctrl.forecastDetail);
router.get('/ai/stockouts', auth, ctrl.stockouts);
router.get('/ai/anomalias', auth, ctrl.anomalias);
router.get('/ai/precios', auth, ctrl.precios);
router.get('/ai/insights', auth, ctrl.insights);

module.exports = router;
