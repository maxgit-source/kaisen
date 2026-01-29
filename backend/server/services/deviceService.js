const os = require('os');
const crypto = require('crypto');
const configRepo = require('../db/repositories/configRepository');

const DEVICE_ID_KEY = 'cloud_device_id';

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

function collectHardwareSnapshot() {
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0]?.model || '';
  const cpuCount = cpus.length || 0;

  const macs = [];
  const ifaces = os.networkInterfaces() || {};
  for (const infos of Object.values(ifaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (!info || info.internal) continue;
      const mac = String(info.mac || '').toLowerCase();
      if (!mac || mac === '00:00:00:00:00:00') continue;
      macs.push(mac);
    }
  }
  macs.sort();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    cpuModel,
    cpuCount,
    macs,
  };
}

function computeDeviceId() {
  const snapshot = collectHardwareSnapshot();
  const raw = stableStringify(snapshot);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `HW-${hash.slice(0, 20).toUpperCase()}`;
}

async function getOrCreateDeviceId(usuarioId) {
  let deviceId = await configRepo.getTextParam(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = computeDeviceId();
    await configRepo.setTextParam(DEVICE_ID_KEY, deviceId, usuarioId || null);
  }
  return deviceId;
}

module.exports = {
  getOrCreateDeviceId,
  computeDeviceId,
};
