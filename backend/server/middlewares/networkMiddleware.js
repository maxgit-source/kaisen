const configRepo = require('../db/repositories/configRepository');

const CACHE_TTL_MS = 30 * 1000;
let cachedPolicy = null;
let cachedSubnet = null;
let cachedAt = 0;

function normalizeIp(raw) {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  return ip;
}

function ipToInt(ip) {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  return (
    (parts[0] << 24) +
    (parts[1] << 16) +
    (parts[2] << 8) +
    parts[3]
  ) >>> 0;
}

function isPrivateIpv4(ip) {
  const n = ipToInt(ip);
  if (n == null) return false;
  const ten = ipToInt('10.0.0.0');
  const tenMask = ipToInt('255.0.0.0');
  const oneSevenTwo = ipToInt('172.16.0.0');
  const oneSevenTwoMask = ipToInt('255.240.0.0');
  const oneNineTwo = ipToInt('192.168.0.0');
  const oneNineTwoMask = ipToInt('255.255.0.0');
  const loopback = ipToInt('127.0.0.0');
  const loopMask = ipToInt('255.0.0.0');
  const linkLocal = ipToInt('169.254.0.0');
  const linkMask = ipToInt('255.255.0.0');
  return (
    (n & tenMask) === ten ||
    (n & oneSevenTwoMask) === oneSevenTwo ||
    (n & oneNineTwoMask) === oneNineTwo ||
    (n & loopMask) === loopback ||
    (n & linkMask) === linkLocal
  );
}

function matchesSubnet(ip, subnet) {
  if (!ip || !subnet) return false;
  const [base, prefixStr] = String(subnet).split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const baseInt = ipToInt(base);
  const ipInt = ipToInt(ip);
  if (baseInt == null || ipInt == null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (baseInt & mask) === (ipInt & mask);
}

async function loadPolicy() {
  const now = Date.now();
  if (cachedAt && now - cachedAt < CACHE_TTL_MS) {
    return { policy: cachedPolicy, subnet: cachedSubnet };
  }
  const policy = (await configRepo.getNetworkPolicy()) || 'off';
  const subnet = await configRepo.getNetworkSubnet();
  cachedPolicy = policy;
  cachedSubnet = subnet;
  cachedAt = now;
  return { policy, subnet };
}

function allowByPolicy(ip, policy, subnet) {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (policy === 'off') return true;
  if (policy === 'private') return isPrivateIpv4(ip);
  if (policy === 'subnet') return matchesSubnet(ip, subnet);
  return true;
}

async function networkGuard(req, res, next) {
  const path = req.path || '';
  if (path === '/healthz' || path === '/server-info') {
    return next();
  }
  try {
    const { policy, subnet } = await loadPolicy();
    const ip = normalizeIp(req.ip);
    if (!allowByPolicy(ip, policy, subnet)) {
      return res.status(403).json({ error: 'Acceso restringido a la red local' });
    }
    return next();
  } catch (err) {
    console.error('Network policy error:', err.message);
    return res.status(500).json({ error: 'No se pudo validar la red' });
  }
}

module.exports = networkGuard;
