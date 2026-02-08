const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/setupcontroller');
const { apiLimiter } = require('../middlewares/security');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { uploadBackupSingle } = require('../middlewares/backupUploadMiddleware');

router.get('/setup/status', apiLimiter, ctrl.status);
router.post('/setup/admin', apiLimiter, ctrl.createAdmin);
router.post('/setup/restore-backup', apiLimiter, uploadBackupSingle('file'), ctrl.restoreBackup);
router.post(
  '/setup/reset-database',
  apiLimiter,
  auth,
  requireRole(['admin']),
  ctrl.resetDatabase
);

module.exports = router;
