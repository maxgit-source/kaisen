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
}

const args = process.argv.slice(2);
if (args.length < 1) {
  usage();
  process.exit(1);
}

const installId = args[0];
const maxUsers = args[1] ? Number(args[1]) : null;
const expiresAt = args[2] ? String(args[2]) : null;

if (!installId || installId.length < 6) {
  console.error('INSTALL_ID invalido');
  process.exit(1);
}

if (args[1] && !Number.isFinite(maxUsers)) {
  console.error('MAX_USERS invalido');
  process.exit(1);
}

if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
  console.error('EXPIRES_AT invalido (use YYYY-MM-DD)');
  process.exit(1);
}

const privateKey = loadPrivateKey();
if (!privateKey) {
  console.error('No se encontro LICENSE_PRIVATE_KEY ni keys/license_private.pem');
  process.exit(1);
}

const payload = {
  install_id: installId,
  features: ['usuarios'],
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
