const fs = require('fs');
const path = require('path');
const { backupTo, restoreFrom } = require('../db/pg');
const configRepo = require('../db/repositories/configRepository');

const DB_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, '../../database/app.sqlite');
const BASE_DIR = path.dirname(DB_PATH);
const BACKUP_DIR = path.join(BASE_DIR, 'backups');

const CONFIG_KEYS = {
  enabled: 'backup_enabled',
  intervalHours: 'backup_interval_hours',
  retentionDays: 'backup_retention_days',
  externalDir: 'backup_external_dir',
  lastRunAt: 'backup_last_run_at',
  lastSuccessAt: 'backup_last_success_at',
  lastError: 'backup_last_error',
  lastFilename: 'backup_last_filename',
};

function parseEnvBoolean(value, fallback) {
  if (value == null) return fallback;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function parseEnvNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const DEFAULTS = {
  enabled: parseEnvBoolean(process.env.BACKUP_ENABLED, true),
  intervalHours: parseEnvNumber(process.env.BACKUP_INTERVAL_HOURS, 24),
  retentionDays: parseEnvNumber(process.env.BACKUP_RETENTION_DAYS, 7),
  externalDir: String(process.env.BACKUP_EXTERNAL_DIR || '').trim(),
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '_',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

function sanitizeFilename(name) {
  return String(name || '').replace(/[^a-zA-Z0-9_.-]/g, '');
}

function normalizeExternalDir(value) {
  const dir = String(value || '').trim();
  return dir ? dir : '';
}

async function getSettings() {
  const [enabledRaw, intervalRaw, retentionRaw, externalRaw] = await Promise.all([
    configRepo.getNumericParam(CONFIG_KEYS.enabled),
    configRepo.getNumericParam(CONFIG_KEYS.intervalHours),
    configRepo.getNumericParam(CONFIG_KEYS.retentionDays),
    configRepo.getTextParam(CONFIG_KEYS.externalDir),
  ]);
  const enabled =
    enabledRaw == null ? DEFAULTS.enabled : Boolean(Number(enabledRaw));
  const intervalHours =
    intervalRaw == null ? DEFAULTS.intervalHours : Number(intervalRaw);
  const retentionDays =
    retentionRaw == null ? DEFAULTS.retentionDays : Number(retentionRaw);
  const externalDir = normalizeExternalDir(
    externalRaw != null ? externalRaw : DEFAULTS.externalDir
  );
  return {
    enabled,
    interval_hours: Number.isFinite(intervalHours) ? intervalHours : DEFAULTS.intervalHours,
    retention_days: Number.isFinite(retentionDays) ? retentionDays : DEFAULTS.retentionDays,
    external_dir: externalDir,
  };
}

function validateNumber(value, { min = 0 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min) return null;
  return num;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Boolean(value);
  const raw = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

async function saveSettings(payload = {}, usuarioId = null) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload invalido');
  }
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'enabled')) {
    updates.enabled = parseBoolean(payload.enabled, DEFAULTS.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'interval_hours')) {
    const interval = validateNumber(payload.interval_hours, { min: 0 });
    if (interval == null) throw new Error('interval_hours invalido');
    updates.interval_hours = interval;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'retention_days')) {
    const retention = validateNumber(payload.retention_days, { min: 0 });
    if (retention == null) throw new Error('retention_days invalido');
    updates.retention_days = retention;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'external_dir')) {
    updates.external_dir = normalizeExternalDir(payload.external_dir);
  }

  const tasks = [];
  if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) {
    tasks.push(
      configRepo.setNumericParam(
        CONFIG_KEYS.enabled,
        updates.enabled ? 1 : 0,
        usuarioId
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'interval_hours')) {
    tasks.push(
      configRepo.setNumericParam(
        CONFIG_KEYS.intervalHours,
        updates.interval_hours,
        usuarioId
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'retention_days')) {
    tasks.push(
      configRepo.setNumericParam(
        CONFIG_KEYS.retentionDays,
        updates.retention_days,
        usuarioId
      )
    );
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'external_dir')) {
    tasks.push(
      configRepo.setTextParam(
        CONFIG_KEYS.externalDir,
        updates.external_dir || null,
        usuarioId
      )
    );
  }

  if (tasks.length) {
    await Promise.all(tasks);
  }
  await reloadBackupScheduler();
  return getSettings();
}

function getBackupFilePath(filename) {
  const safeName = sanitizeFilename(filename);
  if (!safeName) return null;
  return path.join(BACKUP_DIR, safeName);
}

async function recordBackupSuccess(info, mirrorError) {
  const now = new Date().toISOString();
  const tasks = [
    configRepo.setTextParam(CONFIG_KEYS.lastRunAt, now, null),
    configRepo.setTextParam(CONFIG_KEYS.lastSuccessAt, now, null),
    configRepo.setTextParam(CONFIG_KEYS.lastFilename, info?.filename || null, null),
    configRepo.setTextParam(
      CONFIG_KEYS.lastError,
      mirrorError ? String(mirrorError.message || mirrorError) : null,
      null
    ),
  ];
  await Promise.all(tasks);
}

async function recordBackupError(err) {
  const now = new Date().toISOString();
  const tasks = [
    configRepo.setTextParam(CONFIG_KEYS.lastRunAt, now, null),
    configRepo.setTextParam(
      CONFIG_KEYS.lastError,
      String(err?.message || err || 'Error desconocido'),
      null
    ),
  ];
  await Promise.all(tasks);
}

function copyToExternal(filePath, externalDir) {
  if (!externalDir) return null;
  const targetDir = path.resolve(externalDir);
  ensureDir(targetDir);
  const targetPath = path.join(targetDir, path.basename(filePath));
  if (path.resolve(targetPath) === path.resolve(filePath)) return targetPath;
  fs.copyFileSync(filePath, targetPath);
  return targetPath;
}

async function createBackup(options = {}) {
  const settings = options.settings || (await getSettings());
  ensureDir(BACKUP_DIR);
  const filename = `backup_${timestamp()}.sqlite`;
  const filePath = path.join(BACKUP_DIR, filename);
  try {
    await backupTo(filePath);
  } catch (err) {
    await recordBackupError(err);
    throw err;
  }
  const info = getBackupInfo(filePath);
  let mirrorError = null;
  try {
    if (settings.external_dir) {
      copyToExternal(filePath, settings.external_dir);
    }
  } catch (err) {
    mirrorError = err;
  }
  await recordBackupSuccess(info, mirrorError);
  if (mirrorError) {
    info.mirror_error = mirrorError.message || String(mirrorError);
  }
  return info;
}

function getBackupInfo(filePath) {
  const stats = fs.statSync(filePath);
  return {
    filename: path.basename(filePath),
    size: stats.size,
    created_at: stats.mtime.toISOString(),
  };
}

function listBackups() {
  ensureDir(BACKUP_DIR);
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => path.join(BACKUP_DIR, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files.map((filePath) => getBackupInfo(filePath));
}

async function restoreBackup(filename) {
  ensureDir(BACKUP_DIR);
  const safeName = sanitizeFilename(filename);
  const filePath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error('Backup no encontrado');
  }
  await restoreFrom(filePath);
  await reloadBackupScheduler();
  return true;
}

async function restoreFromUpload(tempPath, originalName) {
  ensureDir(BACKUP_DIR);
  const ext = path.extname(originalName || '').toLowerCase() || '.sqlite';
  const safeExt = ext === '.db' || ext === '.sqlite' ? ext : '.sqlite';
  const filename = `restore_${timestamp()}${safeExt}`;
  const filePath = path.join(BACKUP_DIR, sanitizeFilename(filename));
  fs.copyFileSync(tempPath, filePath);
  await restoreFrom(filePath);
  await reloadBackupScheduler();
  return getBackupInfo(filePath);
}

function cleanupOldBackups(retentionDays, opts = {}) {
  if (!retentionDays || retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const dirs = [BACKUP_DIR];
  if (opts.externalDir) {
    dirs.push(path.resolve(opts.externalDir));
  }
  for (const dir of dirs) {
    try {
      ensureDir(dir);
      const files = fs.readdirSync(dir);
      for (const name of files) {
        if (!name.endsWith('.sqlite')) continue;
        const filePath = path.join(dir, name);
        try {
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < cutoff) {
            fs.unlinkSync(filePath);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
}

let scheduler = null;
let schedulerIntervalMs = null;
let nextRunAt = null;
let schedulerRunning = false;

async function runScheduledBackup() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    const settings = await getSettings();
    if (!settings.enabled) return;
    await createBackup({ settings });
    cleanupOldBackups(settings.retention_days, { externalDir: settings.external_dir });
  } catch (err) {
    console.error('Backup scheduler error:', err.message);
  } finally {
    if (schedulerIntervalMs) {
      nextRunAt = new Date(Date.now() + schedulerIntervalMs).toISOString();
    }
    schedulerRunning = false;
  }
}

function stopBackupScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
  schedulerIntervalMs = null;
  nextRunAt = null;
}

async function reloadBackupScheduler() {
  const settings = await getSettings();
  if (!settings.enabled) {
    stopBackupScheduler();
    return { active: false, settings };
  }
  const intervalMs = Number(settings.interval_hours) * 60 * 60 * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    stopBackupScheduler();
    return { active: false, settings };
  }
  if (scheduler && schedulerIntervalMs === intervalMs) {
    return { active: true, settings };
  }
  stopBackupScheduler();
  schedulerIntervalMs = intervalMs;
  scheduler = setInterval(runScheduledBackup, intervalMs);
  nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  return { active: true, settings };
}

function startBackupScheduler() {
  if (scheduler) return;
  reloadBackupScheduler().catch((err) => {
    console.error('Backup scheduler error:', err.message);
  });
}

async function getStatus() {
  const settings = await getSettings();
  const [lastRunAt, lastSuccessAt, lastError, lastFilename] = await Promise.all([
    configRepo.getTextParam(CONFIG_KEYS.lastRunAt),
    configRepo.getTextParam(CONFIG_KEYS.lastSuccessAt),
    configRepo.getTextParam(CONFIG_KEYS.lastError),
    configRepo.getTextParam(CONFIG_KEYS.lastFilename),
  ]);
  return {
    settings,
    scheduler_active: Boolean(scheduler),
    next_run_at: nextRunAt,
    last_run_at: lastRunAt,
    last_success_at: lastSuccessAt,
    last_error: lastError,
    last_filename: lastFilename,
  };
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  cleanupOldBackups,
  startBackupScheduler,
  reloadBackupScheduler,
  getSettings,
  saveSettings,
  getStatus,
  getBackupFilePath,
  restoreFromUpload,
};
