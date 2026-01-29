const configRepo = require('../db/repositories/configRepository');
const deviceService = require('./deviceService');

const CLOUD_TOKEN_KEY = 'cloud_token';
const CLOUD_ENDPOINT_KEY = 'cloud_endpoint';
const CLOUD_SLUG_KEY = 'cloud_slug';

function parseSlugFromToken(token) {
  const raw = String(token || '').trim();
  if (!raw || !raw.toUpperCase().startsWith('TL-')) return null;
  const parts = raw.split('-').filter(Boolean);
  if (parts.length < 4) return null;
  const slugParts = parts.slice(1, -2);
  if (!slugParts.length) return null;
  return slugParts.join('-').toLowerCase();
}

function maskToken(token) {
  if (!token) return null;
  const raw = String(token);
  if (raw.length <= 8) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
}

async function getStatus({ usuarioId } = {}) {
  const [token, endpoint, deviceId] = await Promise.all([
    configRepo.getTextParam(CLOUD_TOKEN_KEY),
    configRepo.getTextParam(CLOUD_ENDPOINT_KEY),
    deviceService.getOrCreateDeviceId(usuarioId || null),
  ]);
  const slug = await configRepo.getTextParam(CLOUD_SLUG_KEY);

  return {
    linked: Boolean(token),
    token_preview: maskToken(token),
    endpoint: endpoint || null,
    device_id: deviceId || null,
    slug: slug || null,
  };
}

async function activate({ token, endpoint, usuarioId }) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    const err = new Error('Token requerido');
    err.status = 400;
    throw err;
  }
  if (endpoint) {
    const trimmed = String(endpoint || '').trim();
    await configRepo.setTextParam(CLOUD_ENDPOINT_KEY, trimmed || null, usuarioId || null);
  }
  await configRepo.setTextParam(CLOUD_TOKEN_KEY, cleanToken, usuarioId || null);
  const slug = parseSlugFromToken(cleanToken);
  if (slug) {
    await configRepo.setTextParam(CLOUD_SLUG_KEY, slug, usuarioId || null);
  }
  await deviceService.getOrCreateDeviceId(usuarioId || null);
  return getStatus({ usuarioId });
}

module.exports = { getStatus, activate };
