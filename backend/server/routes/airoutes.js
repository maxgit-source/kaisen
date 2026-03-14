const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aicontroller');
const reportCtrl = require('../controllers/reportaicontroller');
const auth = require('../middlewares/authmiddleware');
const { requireFeature } = require('../middlewares/licenseMiddleware');
const { aiLimiter } = require('../middlewares/security');

router.get('/ai/forecast', aiLimiter, auth, requireFeature('ai'), ctrl.forecast);
router.get('/ai/forecast/:id/serie', aiLimiter, auth, requireFeature('ai'), ctrl.forecastDetail);
router.get('/ai/stockouts', aiLimiter, auth, requireFeature('ai'), ctrl.stockouts);
router.get('/ai/anomalias', aiLimiter, auth, requireFeature('ai'), ctrl.anomalias);
router.get('/ai/precios', aiLimiter, auth, requireFeature('ai'), ctrl.precios);
router.get('/ai/insights', aiLimiter, auth, requireFeature('ai'), ctrl.insights);
router.get('/ai/report-data', aiLimiter, auth, requireFeature('ai'), reportCtrl.reportData);
router.post('/ai/report-summary', aiLimiter, auth, requireFeature('ai'), reportCtrl.reportSummary);
router.post('/ai/predictions-summary', aiLimiter, auth, requireFeature('ai'), ctrl.predictionsSummary);

module.exports = router;
