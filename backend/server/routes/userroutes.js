const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usercontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { requireFeature } = require('../middlewares/licenseMiddleware');

// Admin only
router.get('/usuarios', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.list);
router.get('/usuarios/rendimiento', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.sellerPerformance);
router.post('/usuarios', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.create);
router.put('/usuarios/:id', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.update);
router.get('/roles', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.roles);
router.get('/usuarios/:id/depositos', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.getUserDepositos);
router.put('/usuarios/:id/depositos', auth, requireFeature('usuarios'), requireRole(['admin']), ctrl.setUserDepositos);

module.exports = router;
