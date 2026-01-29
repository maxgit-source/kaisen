const fs = require('fs');
const path = require('path');
const { backupTo, restoreFrom } = require('../db/pg');

const DB_PATH = process.env.SQLITE_PATH || path.resolve(__dirname, '../../database/app.sqlite');
const BASE_DIR = path.dirname(DB_PATH);
const BACKUP_DIR = path.join(BASE_DIR, 'backups');

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

async function createBackup() {
  ensureDir(BACKUP_DIR);
  const filename = `backup_${timestamp()}.sqlite`;
  const filePath = path.join(BACKUP_DIR, filename);
  await backupTo(filePath);
  return getBackupInfo(filePath);
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
  return true;
}

function cleanupOldBackups(retentionDays) {
  if (!retentionDays || retentionDays <= 0) return;
  ensureDir(BACKUP_DIR);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(BACKUP_DIR);
  for (const name of files) {
    if (!name.endsWith('.sqlite')) continue;
    const filePath = path.join(BACKUP_DIR, name);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
      }
    } catch (_) {}
  }
}

let scheduler = null;
function startBackupScheduler() {
  const hours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
  const retention = Number(process.env.BACKUP_RETENTION_DAYS || 7);
  if (!Number.isFinite(hours) || hours <= 0) return;
  if (scheduler) return;
  scheduler = setInterval(async () => {
    try {
      await createBackup();
      cleanupOldBackups(retention);
    } catch (err) {
      console.error('Backup scheduler error:', err.message);
    }
  }, hours * 60 * 60 * 1000);
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  cleanupOldBackups,
  startBackupScheduler,
};
