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

async function status(req, res) {
  try {
    const data = await backupService.getStatus();
    res.json(data);
  } catch (err) {
    console.error('Backup status error:', err.message);
    res.status(500).json({ error: 'No se pudo obtener el estado de backups' });
  }
}

async function saveSettings(req, res) {
  try {
    const usuarioId = req.user?.id || null;
    const settings = await backupService.saveSettings(req.body || {}, usuarioId);
    res.json({ message: 'Configuracion guardada', settings });
  } catch (err) {
    console.error('Backup settings error:', err.message);
    res.status(400).json({ error: err.message || 'No se pudo guardar configuracion' });
  }
}

async function download(req, res) {
  const filename = String(req.params?.filename || '').trim();
  if (!filename) {
    return res.status(400).json({ error: 'filename requerido' });
  }
  try {
    const filePath = backupService.getBackupFilePath(filename);
    if (!filePath || !require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup no encontrado' });
    }
    return res.download(filePath, filename);
  } catch (err) {
    console.error('Backup download error:', err.message);
    return res.status(500).json({ error: 'No se pudo descargar el backup' });
  }
}

async function restoreFromFile(req, res) {
  const file = req.file;
  if (!file || !file.path) {
    return res.status(400).json({ error: 'Archivo requerido' });
  }
  try {
    const info = await backupService.restoreFromUpload(file.path, file.originalname);
    res.json({ message: 'Backup restaurado', backup: info });
  } catch (err) {
    console.error('Backup restore-file error:', err.message);
    res.status(500).json({ error: 'No se pudo restaurar el backup' });
  } finally {
    try {
      require('fs').unlinkSync(file.path);
    } catch (_) {}
  }
}

module.exports = { list, create, restore, status, saveSettings, download, restoreFromFile };
