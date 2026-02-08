const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/licensecontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/license/install-id', ctrl.publicInstallId);
router.post('/license/activate-public', ctrl.publicActivate);
router.get('/license/status', auth, ctrl.status);
router.post('/license/activate', auth, requireRole(['admin']), ctrl.activate);

module.exports = router;
