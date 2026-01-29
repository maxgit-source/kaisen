const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cloudcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/cloud/status', auth, requireRole(['admin']), ctrl.status);
router.post('/cloud/activate', auth, requireRole(['admin']), ctrl.activate);
router.post('/cloud/snapshot', auth, requireRole(['admin']), ctrl.snapshot);
router.get('/cloud/queue-status', auth, requireRole(['admin']), ctrl.queueStatus);

module.exports = router;
