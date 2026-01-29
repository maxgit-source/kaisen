
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath =
  process.env.SQLITE_PATH ||
  path.resolve(__dirname, '../../database/app.sqlite');

let db = global._dbConnection || null;

function connect() {
  if (db) return;
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    global._dbConnection = db;
    console.log('SQLite conectado en:', dbPath);
  } catch (err) {
    console.error('Error conectando SQLite:', err.message);
    throw err;
  }
}

// Inicializar conexión removido - lazy connect
// connect();

function toSqliteTimestamp(value) {
  return value.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

function normalizeParam(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return toSqliteTimestamp(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function normalizeParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map((value) => normalizeParam(value));
}

function normalizeSql(text, params = []) {
  let sql = String(text || '');
  let outParams = [];
  const inputParams = normalizeParams(params);

  if (Array.isArray(inputParams) && inputParams.length) {
    sql = sql.replace(/\$(\d+)/g, (match, n) => {
      const idx = Number(n) - 1;
      outParams.push(idx >= 0 && idx < inputParams.length ? inputParams[idx] : null);
      return '?';
    });
  } else {
    sql = sql.replace(/\$(\d+)/g, '?');
  }

  sql = sql.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
  sql = sql.replace(/::[a-zA-Z_][a-zA-Z0-9_]*(\[\])?/g, '');

  return { sql, params: outParams.length ? outParams : inputParams };
}

function hasMultipleStatements(sql) {
  const clean = sql.replace(/--.*$/gm, '').trim();
  return clean.includes(';');
}

async function query(text, params) {
  if (!db) connect();
  const { sql, params: bound } = normalizeSql(text, params || []);
  if (hasMultipleStatements(sql)) {
    db.exec(sql);
    return { rows: [], rowCount: 0, changes: 0 };
  }
  const stmt = db.prepare(sql);
  if (stmt.reader) {
    const rows = stmt.all(bound);
    return { rows, rowCount: rows.length };
  }
  const info = stmt.run(bound);
  return { rows: [], rowCount: info.changes, lastID: info.lastInsertRowid, changes: info.changes };
}

function createClient() {
  return {
    query,
    release() { },
  };
}

async function withTransaction(fn) {
  if (!db) connect();
  db.exec('BEGIN');
  try {
    const client = createClient();
    const result = await fn(client);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const pool = {
  async query(text, params) {
    return query(text, params);
  },
  async connect() {
    if (!db) connect();
    return createClient();
  },
  async end() {
    if (db) {
      db.close();
      db = null;
      global._dbConnection = null;
    }
  },
  async reconnect() {
    await this.end();
    connect();
  },
};

async function backupTo(filePath) {
  if (!db) connect();
  if (!filePath) throw new Error('Backup path requerido');
  await db.backup(filePath);
  return filePath;
}

async function restoreFrom(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Backup no encontrado');
  }
  if (db) {
    db.close();
    db = null;
  }

  fs.copyFileSync(filePath, dbPath);
  connect();
  return true;
}

module.exports = { pool, query, withTransaction, backupTo, restoreFrom, dbPath };

