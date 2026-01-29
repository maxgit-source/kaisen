const syncRepo = require('../db/repositories/syncQueueRepository');
const cloudIdentityService = require('./cloudIdentityService');

const DEFAULT_INTERVAL_MS = 45 * 1000;
let timer = null;
let running = false;

function hasFetch() {
  return typeof fetch === 'function';
}

async function flushOnce() {
  if (!hasFetch()) return { skipped: true, reason: 'no_fetch' };
  const status = await cloudIdentityService.getStatus();
  if (!status?.linked || !status?.endpoint) {
    return { skipped: true, reason: 'not_linked' };
  }

  const events = await syncRepo.listPending({ limit: 50 });
  if (!events.length) return { skipped: true, reason: 'empty' };

  for (const ev of events) {
    await syncRepo.markProcessing(ev.id);
  }

  const payload = {
    device_id: status.device_id,
    events: events.map((e) => {
      let parsed = null;
      if (e.payload) {
        try {
          parsed = JSON.parse(e.payload);
        } catch {
          parsed = null;
        }
      }
      return {
        id: e.id,
        entity: e.entity,
        entity_id: e.entity_id,
        action: e.action,
        payload: parsed,
        created_at: e.created_at,
      };
    }),
  };

  try {
    const token = await getTokenValue();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${status.endpoint.replace(/\/$/, '')}/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      for (const ev of events) {
        await syncRepo.markError(ev.id, `http_${res.status}:${text}`);
      }
      return { ok: false, status: res.status };
    }
    for (const ev of events) {
      await syncRepo.markSent(ev.id);
    }
    return { ok: true, sent: events.length };
  } catch (err) {
    const msg = err?.message || 'sync_error';
    for (const ev of events) {
      await syncRepo.markError(ev.id, msg);
    }
    return { ok: false, error: msg };
  }
}

async function getTokenValue() {
  try {
    const { getTextParam } = require('../db/repositories/configRepository');
    const token = await getTextParam('cloud_token');
    return token || '';
  } catch (_) {
    return '';
  }
}

function startCloudSyncScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await flushOnce();
    } finally {
      running = false;
    }
  }, intervalMs);
}

function stopCloudSyncScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  startCloudSyncScheduler,
  stopCloudSyncScheduler,
  flushOnce,
};
