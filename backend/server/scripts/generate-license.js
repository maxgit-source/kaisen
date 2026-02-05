const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function formatCode(raw) {
  const groups = String(raw).match(/.{1,4}/g) || [];
  return `SG1 ${groups.join(' ')}`;
}

function loadPrivateKey() {
  if (process.env.LICENSE_PRIVATE_KEY) {
    return process.env.LICENSE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
  const keyPath = path.join(__dirname, '..', 'keys', 'license_private.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8');
  }
  return null;
}

function usage() {
  console.log('Uso: node generate-license.js <INSTALL_ID> [MAX_USERS] [EXPIRES_AT]');
  console.log('Ej:  node generate-license.js SG-ABCD-1K2L-Z9 5 2026-12-31');
  console.log('Uso con plan: node generate-license.js <INSTALL_ID> --plan=pro --users=10 --expires=2026-12-31');
  console.log('Planes: inicio, pro, full');
  console.log('Features: por defecto todas. Para limitar usar LICENSE_FEATURES env.');
  console.log('Ej:  set LICENSE_FEATURES=usuarios,arca,ai && node generate-license.js SG-ABCD-1K2L-Z9 5 2026-12-31');
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length < 1) {
  usage();
  process.exit(1);
}

function readArgValue(arg, next) {
  if (arg && arg.includes('=')) {
    return arg.split('=').slice(1).join('=');
  }
  return next || null;
}

const opts = {
  installId: null,
  maxUsers: null,
  expiresAt: null,
  plan: null,
};

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];
  if (arg.startsWith('--plan')) {
    opts.plan = readArgValue(arg, rawArgs[i + 1]);
    if (!arg.includes('=')) i += 1;
    continue;
  }
  if (arg.startsWith('--users') || arg.startsWith('--max-users')) {
    opts.maxUsers = readArgValue(arg, rawArgs[i + 1]);
    if (!arg.includes('=')) i += 1;
    continue;
  }
  if (arg.startsWith('--expires') || arg.startsWith('--expires-at')) {
    opts.expiresAt = readArgValue(arg, rawArgs[i + 1]);
    if (!arg.includes('=')) i += 1;
    continue;
  }
  if (!opts.installId) {
    opts.installId = arg;
    continue;
  }
  if (opts.maxUsers == null) {
    opts.maxUsers = arg;
    continue;
  }
  if (!opts.expiresAt) {
    opts.expiresAt = arg;
  }
}

const installId = opts.installId;
const maxUsers = opts.maxUsers != null ? Number(opts.maxUsers) : null;
const expiresAt = opts.expiresAt ? String(opts.expiresAt) : null;

if (!installId || installId.length < 6) {
  console.error('INSTALL_ID invalido');
  process.exit(1);
}

if (opts.maxUsers != null && !Number.isFinite(maxUsers)) {
  console.error('MAX_USERS invalido');
  process.exit(1);
}

if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
  console.error('EXPIRES_AT invalido (use YYYY-MM-DD)');
  process.exit(1);
}

const ALL_FEATURES = [
  'usuarios',
  'arca',
  'ai',
  'marketplace',
  'cloud',
  'aprobaciones',
  'crm',
  'postventa',
  'multideposito',
];

const PLAN_PRESETS = {
  inicio: {
    label: 'Inicio',
    features: ['usuarios'],
  },
  pro: {
    label: 'Pro',
    features: ['usuarios', 'arca', 'ai', 'crm', 'postventa', 'aprobaciones'],
  },
  full: {
    label: 'Full',
    features: [...ALL_FEATURES],
  },
};

function normalizePlanName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function parseFeatureList(raw, fallback) {
  if (!raw) return fallback;
  const list = String(raw)
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  return list.length ? list : fallback;
}

let planPreset = null;
if (opts.plan) {
  const planKey = normalizePlanName(opts.plan);
  planPreset = PLAN_PRESETS[planKey] || null;
  if (!planPreset) {
    console.error(`PLAN invalido: ${opts.plan}`);
    console.error(`Planes validos: ${Object.keys(PLAN_PRESETS).join(', ')}`);
    process.exit(1);
  }
}

const featuresFromEnv = parseFeatureList(process.env.LICENSE_FEATURES, null);
let features = ALL_FEATURES;
if (planPreset) {
  features = planPreset.features;
}
if (featuresFromEnv && !planPreset) {
  features = featuresFromEnv;
}
if (featuresFromEnv && planPreset) {
  console.warn('LICENSE_FEATURES esta definido; se ignora porque usaste --plan.');
}

const privateKey = loadPrivateKey();
if (!privateKey) {
  console.error('No se encontro LICENSE_PRIVATE_KEY ni keys/license_private.pem');
  process.exit(1);
}

const payload = {
  install_id: installId,
  features,
  max_users: maxUsers != null ? maxUsers : undefined,
  expires_at: expiresAt || undefined,
};

if (payload.max_users === undefined) delete payload.max_users;
if (payload.expires_at === undefined) delete payload.expires_at;

const payloadStr = stableStringify(payload);
const signature = crypto.sign('RSA-SHA256', Buffer.from(payloadStr, 'utf8'), privateKey);
const envelope = {
  v: 1,
  payload,
  sig: base64UrlEncode(signature),
};

const code = base64UrlEncode(JSON.stringify(envelope));
const rawCode = `SG1${code}`;
console.log('Codigo de licencia:');
console.log(formatCode(rawCode));
console.log('\nCodigo sin formato (recomendado para pegar):');
console.log(rawCode);
