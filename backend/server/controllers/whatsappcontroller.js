const logger = require('../lib/logger');
const {
  getActiveProvider,
  getActiveProviderStatus,
  resolveProviderName,
} = require('../services/messaging/providerRegistry');

function isWebProvider() {
  return resolveProviderName() === 'web';
}

function providerNotSupportedResponse(res, operation) {
  return res.status(400).json({
    error: 'La operacion ' + operation + ' no esta disponible con el proveedor activo.',
    hint: 'Configura WHATSAPP_PROVIDER=web en el archivo .env para usar WhatsApp Web.',
  });
}

async function getStatus(req, res) {
  try {
    const status = await getActiveProviderStatus();
    res.json(status);
  } catch (err) {
    logger.error({ err: err?.message || err }, '[whatsapp:status]');
    res.status(500).json({ error: 'No se pudo obtener el estado de WhatsApp' });
  }
}

async function connect(req, res) {
  if (!isWebProvider()) return providerNotSupportedResponse(res, 'connect');
  const force = req.body != null && req.body.force === true;
  try {
    const provider = getActiveProvider();
    const current = await provider.getStatus();
    if (current.state === 'connected' && !force) return res.json(current);
    await provider.connect({ force });
    const status = await provider.getStatus();
    res.json(status);
  } catch (err) {
    logger.error({ err: err?.message || err }, '[whatsapp:connect]');
    res.status(500).json({ error: err?.message || 'No se pudo iniciar la conexion de WhatsApp' });
  }
}

async function getQr(req, res) {
  if (!isWebProvider()) return providerNotSupportedResponse(res, 'qr');
  try {
    const provider = getActiveProvider();
    const status = await provider.getStatus();
    if (status.state === 'connected') {
      return res.status(409).json({ error: 'WhatsApp ya esta conectado. No hay QR disponible.', state: status.state, phone: status.phone || null });
    }
    const qr = await provider.getLatestQR();
    if (!qr) return res.status(404).json({ error: 'No hay un QR disponible. Inicia la conexion primero.', state: status.state });
    res.json({ qr, state: status.state, qrUpdatedAt: status.qrUpdatedAt || null });
  } catch (err) {
    logger.error({ err: err?.message || err }, '[whatsapp:qr]');
    res.status(500).json({ error: 'No se pudo obtener el QR de WhatsApp' });
  }
}

async function disconnect(req, res) {
  if (!isWebProvider()) return providerNotSupportedResponse(res, 'disconnect');
  try {
    const provider = getActiveProvider();
    await provider.disconnect();
    const status = await provider.getStatus();
    res.json(status);
  } catch (err) {
    logger.error({ err: err?.message || err }, '[whatsapp:disconnect]');
    res.status(500).json({ error: err?.message || 'No se pudo desconectar WhatsApp' });
  }
}

module.exports = { getStatus, connect, getQr, disconnect };