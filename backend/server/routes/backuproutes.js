const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/backupcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { uploadBackupSingle } = require('../middlewares/backupUploadMiddleware');

router.get('/backups', auth, requireRole(['admin']), ctrl.list);
router.get('/backups/status', auth, requireRole(['admin']), ctrl.status);
router.put('/backups/settings', auth, requireRole(['admin']), ctrl.saveSettings);
router.post('/backups/settings', auth, requireRole(['admin']), ctrl.saveSettings);
router.post('/backups', auth, requireRole(['admin']), ctrl.create);
router.post('/backups/restore', auth, requireRole(['admin']), ctrl.restore);
router.post(
  '/backups/restore-file',
  auth,
  requireRole(['admin']),
  uploadBackupSingle('file'),
  ctrl.restoreFromFile
);
router.get('/backups/download/:filename', auth, requireRole(['admin']), ctrl.download);

module.exports = router;
