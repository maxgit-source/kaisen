const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/backupcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/backups', auth, requireRole(['admin']), ctrl.list);
router.post('/backups', auth, requireRole(['admin']), ctrl.create);
router.post('/backups/restore', auth, requireRole(['admin']), ctrl.restore);

module.exports = router;
