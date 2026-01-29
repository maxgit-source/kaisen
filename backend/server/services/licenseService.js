const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const configRepo = require('../db/repositories/configRepository');

const INSTALL_ID_KEY = 'install_id';
const LICENSE_CODE_KEY = 'license_code';
const FEATURE_USUARIOS = 'usuarios';

function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/\s+/g, '');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

function loadPublicKey() {
  if (process.env.LICENSE_PUBLIC_KEY) {
    return process.env.LICENSE_PUBLIC_KEY.replace(/\\n/g, '\n');
  }
  const keyPath = path.join(__dirname, '..', 'keys', 'license_public.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }
  return null;
}

const PUBLIC_KEY = loadPublicKey();

function generateInstallId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (n) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `SG-${rand(4)}-${stamp}-${rand(2)}`;
}

async function getOrCreateInstallId(usuarioId) {
  let id = await configRepo.getTextParam(INSTALL_ID_KEY);
  if (!id) {
    id = generateInstallId();
    await configRepo.setTextParam(INSTALL_ID_KEY, id, usuarioId);
  }
  return id;
}

function normalizeCode(raw) {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  cleaned = cleaned.replace(/^SG1[\s:._-]*/i, '');
  // Keep only base64url characters
  cleaned = cleaned.replace(/[^A-Za-z0-9_-]/g, '');
  return cleaned;
}

function decodeEnvelope(rawCode) {
  const normalized = normalizeCode(rawCode);
  if (!normalized) return null;
  try {
    const decoded = base64UrlDecode(normalized).toString('utf8');
    const envelope = JSON.parse(decoded);
    return envelope && typeof envelope === 'object' ? envelope : null;
  } catch (_) {
    return null;
  }
}

function parseSignature(sig) {
  if (!sig) return null;
  try {
    return base64UrlDecode(sig);
  } catch (_) {
    return null;
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'INVALID_PAYLOAD';
  if (!payload.install_id || typeof payload.install_id !== 'string') return 'MISSING_INSTALL_ID';
  if (!Array.isArray(payload.features)) return 'MISSING_FEATURES';
  const features = payload.features.filter((f) => typeof f === 'string');
  if (!features.length) return 'MISSING_FEATURES';
  if (payload.max_users != null && !Number.isFinite(Number(payload.max_users))) {
    return 'INVALID_MAX_USERS';
  }
  if (payload.expires_at != null && Number.isNaN(Date.parse(payload.expires_at))) {
    return 'INVALID_EXPIRES_AT';
  }
  return null;
}

function verifyEnvelope(envelope, installId) {
  if (!PUBLIC_KEY) {
    return { ok: false, reason: 'NO_PUBLIC_KEY' };
  }
  if (!envelope) return { ok: false, reason: 'INVALID_CODE' };
  const payload = envelope.payload;
  const signature = envelope.sig || envelope.signature;
  const payloadError = validatePayload(payload);
  if (payloadError) return { ok: false, reason: payloadError };
  if (payload.install_id !== installId) return { ok: false, reason: 'INSTALL_MISMATCH' };
  if (payload.expires_at) {
    const exp = Date.parse(payload.expires_at);
    if (Number.isFinite(exp) && Date.now() > exp) {
      return { ok: false, reason: 'EXPIRED' };
    }
  }
  const sigBuf = parseSignature(signature);
  if (!sigBuf) return { ok: false, reason: 'INVALID_SIGNATURE' };
  const payloadStr = stableStringify(payload);
  const valid = crypto.verify('RSA-SHA256', Buffer.from(payloadStr, 'utf8'), PUBLIC_KEY, sigBuf);
  if (!valid) return { ok: false, reason: 'INVALID_SIGNATURE' };
  return { ok: true, payload };
}

async function getStoredLicenseCode() {
  return configRepo.getTextParam(LICENSE_CODE_KEY);
}

async function setStoredLicenseCode(code, usuarioId) {
  return configRepo.setTextParam(LICENSE_CODE_KEY, code, usuarioId);
}

async function getLicenseStatus(opts = {}) {
  const includeInstallId = Boolean(opts.includeInstallId);
  const installId = await getOrCreateInstallId(opts.usuarioId || null);
  const code = await getStoredLicenseCode();
  if (!code) {
    return {
      install_id: includeInstallId ? installId : null,
      licensed: false,
      features: [],
      max_users: null,
      expires_at: null,
      reason: 'NO_LICENSE',
    };
  }
  const envelope = decodeEnvelope(code);
  const result = verifyEnvelope(envelope, installId);
  if (!result.ok) {
    return {
      install_id: includeInstallId ? installId : null,
      licensed: false,
      features: [],
      max_users: null,
      expires_at: null,
      reason: result.reason,
    };
  }
  const payload = result.payload;
  return {
    install_id: includeInstallId ? installId : null,
    licensed: true,
    features: payload.features || [],
    max_users: payload.max_users != null ? Number(payload.max_users) : null,
    expires_at: payload.expires_at || null,
    reason: null,
  };
}

async function activateLicense(code, usuarioId) {
  const installId = await getOrCreateInstallId(usuarioId || null);
  const envelope = decodeEnvelope(code);
  const result = verifyEnvelope(envelope, installId);
  if (!result.ok) {
    const err = new Error('Licencia invalida');
    err.code = result.reason || 'INVALID_LICENSE';
    throw err;
  }
  await setStoredLicenseCode(code, usuarioId || null);
  return getLicenseStatus({ includeInstallId: true, usuarioId });
}

async function getActiveLicense() {
  const installId = await getOrCreateInstallId(null);
  const code = await getStoredLicenseCode();
  if (!code) return null;
  const envelope = decodeEnvelope(code);
  const result = verifyEnvelope(envelope, installId);
  if (!result.ok) return null;
  return result.payload;
}

function hasFeature(payload, feature) {
  if (!payload || !Array.isArray(payload.features)) return false;
  return payload.features.includes(feature);
}

module.exports = {
  FEATURE_USUARIOS,
  getOrCreateInstallId,
  getLicenseStatus,
  activateLicense,
  getActiveLicense,
  hasFeature,
};
