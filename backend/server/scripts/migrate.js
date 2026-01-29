#!/usr/bin/env node
/* Simple migration runner for PostgreSQL using SQL files */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db/pg');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version VARCHAR(50) PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function parseMigrationFilename(filename) {
  const m = /^V(\d+)__([\w\-]+)\.sql$/.exec(filename);
  if (!m) return null;
  return { version: m[1], name: m[2], filename };
}

async function tableExists(tableName) {
  const { rows } = await pool.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = $1",
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const { rows } = await pool.query(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

async function ensureColumn(tableName, columnName, columnType) {
  if (!(await tableExists(tableName))) return;
  if (await columnExists(tableName, columnName)) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
}

async function ensureMarketplaceExternalIds() {
  const targets = [
    { table: 'pymes_aliadas', index: 'uq_pymes_aliadas_external' },
    { table: 'alianzas', index: 'uq_alianzas_external' },
    { table: 'alianzas_ofertas', index: 'uq_alianzas_ofertas_external' },
    { table: 'referidos', index: 'uq_referidos_external' },
  ];

  for (const target of targets) {
    await ensureColumn(target.table, 'external_id', 'TEXT');
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${target.index} ON ${target.table}(external_id) WHERE external_id IS NOT NULL`
    );
  }
}

async function syncLegacySchemaMigrations(isSqlite) {
  if (!isSqlite) return;
  const hasLegacy = await tableExists('schema_migrations');
  if (!hasLegacy) return;
  const { rows } = await pool.query('SELECT version, name FROM schema_migrations');
  for (const row of rows) {
    const version = String(row.version);
    const name = row.name || `legacy_${version}`;
    await pool.query(
      'INSERT INTO _migrations(version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [version, name]
    );
  }
}

async function getAppliedVersions() {
  const { rows } = await pool.query('SELECT version FROM _migrations');
  const set = new Set(rows.map(r => String(r.version)));
  return set;
}


async function run() {
  const defaultDir = path.resolve(__dirname, '../../database/migrations_sqlite');
  const dir = process.env.DB_MIGRATIONS_DIR || defaultDir;
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) {
    console.error(`No existe la carpeta de migraciones: ${abs}`);
    // No matamos el proceso si se llama desde el controller
    if (require.main === module) process.exit(1);
    throw new Error(`Migration dir not found: ${abs}`);
  }

  let isSqlite = false;
  try {
    await pool.query('SELECT sqlite_version()');
    isSqlite = true;
  } catch (_) {
    isSqlite = false;
  }

  await ensureMigrationsTable();
  await syncLegacySchemaMigrations(isSqlite);
  const applied = await getAppliedVersions();

  const files = fs
    .readdirSync(abs)
    .map(parseMigrationFilename)
    .filter(Boolean)
    .sort((a, b) => Number(a.version) - Number(b.version));

  for (const m of files) {
    if (applied.has(m.version)) {
      if (require.main === module) console.log(`SKIP V${m.version}__${m.name}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(abs, m.filename), 'utf8');
    if (require.main === module) console.log(`APPLY V${m.version}__${m.name}`);
    try {
      if (isSqlite && m.filename === 'V5__marketplace_external_ids.sql') {
        await ensureMarketplaceExternalIds();
        await pool.query('INSERT INTO _migrations(version, name) VALUES ($1, $2)', [m.version, m.name]);
        continue;
      }
      if (!isSqlite) {
        await pool.query('BEGIN');
      }
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations(version, name) VALUES ($1, $2)', [m.version, m.name]);
      if (!isSqlite) {
        await pool.query('COMMIT');
      }
    } catch (err) {
      if (!isSqlite) {
        try {
          await pool.query('ROLLBACK');
        } catch (_) { }
      }
      console.error(`Error en migración V${m.version}:`, err.message || err);
      if (require.main === module) process.exit(1);
      throw err;
    }
  }
  if (require.main === module) {
    console.log('Migraciones aplicadas.');
    await pool.end();
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
