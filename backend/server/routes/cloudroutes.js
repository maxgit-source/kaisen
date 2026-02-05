const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cloudcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { requireFeature } = require('../middlewares/licenseMiddleware');

router.get('/cloud/status', auth, requireFeature('cloud'), requireRole(['admin']), ctrl.status);
router.post('/cloud/activate', auth, requireFeature('cloud'), requireRole(['admin']), ctrl.activate);
router.post('/cloud/snapshot', auth, requireFeature('cloud'), requireRole(['admin']), ctrl.snapshot);
router.get('/cloud/queue-status', auth, requireFeature('cloud'), requireRole(['admin']), ctrl.queueStatus);

module.exports = router;
