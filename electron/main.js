const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let server = null;

app.on('web-contents-created', (_, contents) => {
  if (!app.isPackaged) return;
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});

function isAllowedNavigation(url, allowedOrigins) {
  if (url.startsWith('file://')) return true;
  try {
    const origin = new URL(url).origin;
    return allowedOrigins.has(origin);
  } catch (_) {
    return false;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadOrCreateSecrets(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.jwtSecret && data.refreshSecret) return data;
    } catch (_) { }
  }
  const secrets = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    refreshSecret: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(filePath, JSON.stringify(secrets, null, 2), 'utf8');
  return secrets;
}

async function applySqlFile(filePath, query) {
  if (!fs.existsSync(filePath)) return;
  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!sql) return;
  await query(sql);
}

async function runMigrations(appRoot) {
  const { run } = require(path.join(appRoot, 'backend', 'server', 'scripts', 'migrate'));
  await run();
}

async function runSeed(appRoot) {
  const seedPath = path.join(appRoot, 'backend', 'database', 'seed.sql');
  const { query } = require(path.join(appRoot, 'backend', 'server', 'db', 'pg'));
  await applySqlFile(seedPath, query);
}

function createWindow(appRoot) {
  const isDev = !app.isPackaged;
  const devServer = process.env.ELECTRON_DEV_SERVER_URL;
  const allowedOrigins = new Set();
  if (devServer) {
    try {
      allowedOrigins.add(new URL(devServer).origin);
    } catch (_) { }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: !isDev,
      devTools: isDev,
    },
  });

  if (!isDev) {
    win.setMenuBarVisibility(false);
    win.removeMenu();
  }

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, allowedOrigins)) {
      event.preventDefault();
    }
  });
  if (!isDev) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
    win.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toLowerCase();
      if (key === 'f12' || (input.control && input.shift && key === 'i')) {
        event.preventDefault();
      }
    });
  }

  if (devServer) {
    win.loadURL(devServer);
    return;
  }
  const indexPath = path.join(appRoot, 'frontend-react', 'dist', 'index.html');
  win.loadFile(indexPath);
}

async function boot() {
  const appRoot = app.getAppPath();
  const userData = app.getPath('userData');
  ensureDir(userData);

  const secretsPath = path.join(userData, 'app-secrets.json');
  const secrets = loadOrCreateSecrets(secretsPath);

  const sqlitePath = path.join(userData, 'app.sqlite');
  process.env.SQLITE_PATH = sqlitePath;
  process.env.PORT = process.env.PORT || '3000';
  process.env.JWT_SECRET = process.env.JWT_SECRET || secrets.jwtSecret;
  process.env.REFRESH_TOKEN_SECRET =
    process.env.REFRESH_TOKEN_SECRET || secrets.refreshSecret;
  process.env.CORS_ALLOW_NULL = 'true';
  process.env.DEFAULT_NETWORK_POLICY =
    process.env.DEFAULT_NETWORK_POLICY || 'private';
  process.env.NODE_ENV = app.isPackaged ? 'production' : 'development';

  await runMigrations(appRoot);
  await runSeed(appRoot);

  const { startServer } = require(path.join(appRoot, 'backend', 'server', 'index.js'));
  const serverHost = process.env.APP_SERVER_HOST || '0.0.0.0';
  server = startServer({ host: serverHost, port: Number(process.env.PORT) });
  server.on('error', (err) => {
    console.error('Backend server error:', err);
    dialog.showErrorBox('Error del servidor', err.message || 'No se pudo iniciar el servidor.');
    app.quit();
  });

  createWindow(appRoot);
}

app.whenReady().then(boot).catch(async (err) => {
  console.error('Electron boot error:', err);

  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Error al iniciar',
    message: 'Hubo un error al iniciar el sistema.',
    detail: err.message + '\n\n¿Desea restablecer la base de datos para corregir el problema?',
    buttons: ['Salir', 'Restablecer Base de Datos'],
    defaultId: 0,
    cancelId: 0,
  });

  if (response === 1) { // Restablecer
    try {
      let closeError = null;
      try {
        const appRoot = app.getAppPath();
        const { pool } = require(path.join(appRoot, 'backend', 'server', 'db', 'pg'));
        await pool.end();
      } catch (e) {
        console.error('Error closing pool via require:', e);
        closeError = e.message;
        // Fallback: intentar cerrar desde global si existe
        if (global._dbConnection) {
          try {
            global._dbConnection.close();
            global._dbConnection = null;
          } catch (err2) {
            console.error('Error closing global db:', err2);
            closeError = (closeError ? closeError + ' | ' : '') + err2.message;
          }
        }
      }

      const userData = app.getPath('userData');
      const sqlitePath = path.join(userData, 'app.sqlite');

      if (fs.existsSync(sqlitePath)) {
        // Retry loop for deletion
        let deleted = false;
        let lastError = null;
        for (let i = 0; i < 5; i++) {
          try {
            if (fs.existsSync(sqlitePath)) fs.unlinkSync(sqlitePath);
            deleted = true;
            break;
          } catch (unlinkErr) {
            lastError = unlinkErr;
            // Intento: truncar a 0 bytes
            try {
              fs.truncateSync(sqlitePath, 0);
              deleted = true;
              break;
            } catch (truncErr) { }

            if (unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EPERM') {
              await new Promise(resolve => setTimeout(resolve, 500)); // wait 500ms
              continue;
            }
          }
        }
        if (!deleted) {
          throw new Error(`No se pudo eliminar ni truncar ${sqlitePath}. CloseErr: ${closeError || 'none'}. UnlinkErr: ${lastError?.message}`);
        }
      }
      const { response: restart } = await dialog.showMessageBox({
        type: 'info',
        title: 'Restablecido',
        message: 'Base de datos eliminada correctamente.',
        detail: 'La aplicacion se reiniciara ahora.',
        buttons: ['Ok'],
      });
      boot();
    } catch (resetErr) {
      dialog.showErrorBox('Error fatal', 'No se pudo restablecer: ' + resetErr.message);
      app.quit();
    }
  } else {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server && typeof server.close === 'function') {
    server.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
