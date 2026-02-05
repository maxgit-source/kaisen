const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const configRepo = require('../db/repositories/configRepository');

const INSTALL_ID_KEY = 'install_id';
const LICENSE_CODE_KEY = 'license_code';
const DEMO_START_KEY = 'demo_start_at';
const FEATURE_USUARIOS = 'usuarios';
const FEATURE_ARCA = 'arca';
const FEATURE_AI = 'ai';
const FEATURE_MARKETPLACE = 'marketplace';
const FEATURE_CLOUD = 'cloud';
const FEATURE_APROBACIONES = 'aprobaciones';
const FEATURE_CRM = 'crm';
const FEATURE_POSTVENTA = 'postventa';
const FEATURE_MULTIDEPOSITO = 'multideposito';

const DEMO_DAYS = Number(process.env.DEMO_DAYS) || 3;
const DEMO_MAX_USERS = process.env.DEMO_MAX_USERS
  ? Number(process.env.DEMO_MAX_USERS)
  : null;

const ALL_FEATURES = [
  FEATURE_USUARIOS,
  FEATURE_ARCA,
  FEATURE_AI,
  FEATURE_MARKETPLACE,
  FEATURE_CLOUD,
  FEATURE_APROBACIONES,
  FEATURE_CRM,
  FEATURE_POSTVENTA,
  FEATURE_MULTIDEPOSITO,
];

function parseFeatureList(raw, fallback) {
  if (!raw) return fallback;
  const list = String(raw)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

const DEMO_FEATURES = parseFeatureList(process.env.DEMO_FEATURES, ALL_FEATURES);

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

async function getDemoInfo({ usuarioId, ensure = false } = {}) {
  const code = await getStoredLicenseCode();
  if (code) {
    return {
      active: false,
      expired: false,
      started_at: null,
      expires_at: null,
      days_left: null,
      days_total: DEMO_DAYS,
    };
  }
  let start = await configRepo.getTextParam(DEMO_START_KEY);
  if (!start && ensure) {
    start = new Date().toISOString();
    await configRepo.setTextParam(DEMO_START_KEY, start, usuarioId || null);
  }
  let startMs = start ? Date.parse(start) : NaN;
  if (!Number.isFinite(startMs) && ensure) {
    start = new Date().toISOString();
    startMs = Date.parse(start);
    await configRepo.setTextParam(DEMO_START_KEY, start, usuarioId || null);
  }
  if (!Number.isFinite(startMs)) {
    return {
      active: false,
      expired: false,
      started_at: null,
      expires_at: null,
      days_left: null,
      days_total: DEMO_DAYS,
    };
  }
  const expiresMs = startMs + DEMO_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const expired = now > expiresMs;
  const daysLeft = expired ? 0 : Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000));
  return {
    active: !expired,
    expired,
    started_at: new Date(startMs).toISOString(),
    expires_at: new Date(expiresMs).toISOString(),
    days_left: daysLeft,
    days_total: DEMO_DAYS,
  };
}

async function ensureDemoStart(usuarioId) {
  return getDemoInfo({ usuarioId, ensure: true });
}

function buildDemoPayload(demo) {
  return {
    features: DEMO_FEATURES,
    max_users: Number.isFinite(DEMO_MAX_USERS) ? DEMO_MAX_USERS : null,
    expires_at: demo?.expires_at || null,
  };
}

async function getLicenseStatus(opts = {}) {
  const includeInstallId = Boolean(opts.includeInstallId);
  const installId = await getOrCreateInstallId(opts.usuarioId || null);
  const code = await getStoredLicenseCode();
  if (!code) {
    const demo = await getDemoInfo({ usuarioId: opts.usuarioId || null, ensure: true });
    if (demo.expired) {
      return {
        install_id: includeInstallId ? installId : null,
        licensed: false,
        features: [],
        max_users: null,
        expires_at: null,
        reason: 'DEMO_EXPIRED',
        license_type: 'demo',
        demo_active: false,
        demo_started_at: demo.started_at,
        demo_expires_at: demo.expires_at,
        demo_days_left: demo.days_left,
        demo_days_total: demo.days_total,
      };
    }
    return {
      install_id: includeInstallId ? installId : null,
      licensed: true,
      features: DEMO_FEATURES,
      max_users: Number.isFinite(DEMO_MAX_USERS) ? DEMO_MAX_USERS : null,
      expires_at: demo.expires_at || null,
      reason: null,
      license_type: 'demo',
      demo_active: true,
      demo_started_at: demo.started_at,
      demo_expires_at: demo.expires_at,
      demo_days_left: demo.days_left,
      demo_days_total: demo.days_total,
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
      license_type: 'full',
      demo_active: false,
      demo_started_at: null,
      demo_expires_at: null,
      demo_days_left: null,
      demo_days_total: DEMO_DAYS,
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
    license_type: 'full',
    demo_active: false,
    demo_started_at: null,
    demo_expires_at: null,
    demo_days_left: null,
    demo_days_total: DEMO_DAYS,
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
  if (!code) {
    const demo = await getDemoInfo({ ensure: true });
    if (demo.active) {
      return buildDemoPayload(demo);
    }
    return null;
  }
  const envelope = decodeEnvelope(code);
  const result = verifyEnvelope(envelope, installId);
  if (!result.ok) return null;
  return result.payload;
}

function hasFeature(payload, feature) {
  if (!payload || !Array.isArray(payload.features)) return false;
  return payload.features.includes(feature);
}

async function isDemoExpired() {
  const code = await getStoredLicenseCode();
  if (code) return false;
  const demo = await getDemoInfo({ ensure: false });
  return Boolean(demo.expired);
}

module.exports = {
  FEATURE_USUARIOS,
  getOrCreateInstallId,
  getLicenseStatus,
  activateLicense,
  getActiveLicense,
  hasFeature,
  ensureDemoStart,
  getDemoInfo,
  isDemoExpired,
};
