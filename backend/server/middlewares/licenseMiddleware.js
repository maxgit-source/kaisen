const licenseService = require('../services/licenseService');

function requireFeature(feature) {
  return async function featureGuard(req, res, next) {
    try {
      const status = await licenseService.getLicenseStatus({ includeInstallId: false });
      if (!status.licensed || !status.features.includes(feature)) {
        return res.status(403).json({ error: 'Modulo no habilitado por licencia' });
      }
      return next();
    } catch (err) {
      console.error('License check error:', err.message);
      return res.status(500).json({ error: 'No se pudo validar la licencia' });
    }
  };
}

module.exports = { requireFeature };
