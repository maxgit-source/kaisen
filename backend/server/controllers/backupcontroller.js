const backupService = require('../services/backupService');

async function list(req, res) {
  try {
    const data = backupService.listBackups();
    res.json(data);
  } catch (err) {
    console.error('Backup list error:', err.message);
    res.status(500).json({ error: 'No se pudo listar backups' });
  }
}

async function create(req, res) {
  try {
    const info = await backupService.createBackup();
    res.json({ message: 'Backup creado', backup: info });
  } catch (err) {
    console.error('Backup create error:', err.message);
    res.status(500).json({ error: 'No se pudo crear el backup' });
  }
}

async function restore(req, res) {
  const filename = String(req.body?.filename || '').trim();
  if (!filename) {
    return res.status(400).json({ error: 'filename requerido' });
  }
  try {
    await backupService.restoreBackup(filename);
    res.json({ message: 'Backup restaurado' });
  } catch (err) {
    console.error('Backup restore error:', err.message);
    res.status(500).json({ error: 'No se pudo restaurar el backup' });
  }
}

module.exports = { list, create, restore };
