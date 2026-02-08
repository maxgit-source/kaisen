const { validationResult, check } = require('express-validator');
const licenseService = require('../services/licenseService');

const validateActivate = [
  check('code').notEmpty().withMessage('code es requerido'),
];

async function status(req, res) {
  try {
    const isAdmin = req.user?.role === 'admin';
    const data = await licenseService.getLicenseStatus({
      includeInstallId: isAdmin,
      usuarioId: req.user?.sub ? Number(req.user.sub) : null,
    });
    res.json(data);
  } catch (err) {
    console.error('License status error:', err.message);
    res.status(500).json({ error: 'No se pudo obtener el estado de licencia' });
  }
}

async function activate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const usuarioId = req.user?.sub ? Number(req.user.sub) : null;
  try {
    const data = await licenseService.activateLicense(req.body.code, usuarioId);
    res.json({ message: 'Licencia activada', license: data });
  } catch (err) {
    const code = err?.code;
    const msg = code === 'INSTALL_MISMATCH'
      ? 'La licencia no corresponde a este equipo'
      : code === 'EXPIRED'
        ? 'La licencia esta vencida'
        : 'Licencia invalida';
    res.status(400).json({ error: msg });
  }
}

async function publicInstallId(req, res) {
  try {
    const data = await licenseService.getSupportInfo();
    res.json(data);
  } catch (err) {
    console.error('License public install id error:', err.message);
    res.status(500).json({ error: 'No se pudo obtener el ID de instalacion' });
  }
}

async function publicActivate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const data = await licenseService.activateLicense(req.body.code, null);
    res.json({ message: 'Licencia activada', license: data });
  } catch (err) {
    const code = err?.code;
    const msg = code === 'INSTALL_MISMATCH'
      ? 'La licencia no corresponde a este equipo'
      : code === 'EXPIRED'
        ? 'La licencia esta vencida'
        : 'Licencia invalida';
    res.status(400).json({ error: msg });
  }
}

module.exports = {
  status,
  activate: [...validateActivate, activate],
  publicInstallId,
  publicActivate: [...validateActivate, publicActivate],
};
