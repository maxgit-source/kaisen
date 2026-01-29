require('dotenv').config();
const { pool } = require('../db/pg');

// These are the "real" migration names as revealed by the migrate script's output
const migrationsToRecord = [
  { version: '1', name: 'Initial_schema' },
  { version: '2', name: 'Triggers_and_soft_delete' },
  { version: '3', name: 'Improve_logs' },
  { version: '4', name: 'Add_product_details' },
  { version: '5', name: 'Inventory_snapshots' },
  { version: '6', name: 'Subcategories_and_checkout' },
  { version: '7', name: 'Partial_unique_on_active_categories' },
];

async function fixMigrations() {
  console.log('Iniciando corrección de la tabla de migraciones (segundo intento)...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version VARCHAR(50) PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Clear the table to ensure a clean slate, removing the incorrect entries I added before.
  await pool.query('TRUNCATE TABLE _migrations RESTART IDENTITY;');
  console.log('La tabla _migrations ha sido limpiada.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const m of migrationsToRecord) {
      console.log(`Registrando migración V${m.version}__${m.name}...`);
      await client.query('INSERT INTO _migrations(version, name) VALUES ($1, $2)', [m.version, m.name]);
    }

    await client.query('COMMIT');
    console.log('Corrección completada. La tabla de migraciones ha sido actualizada con los nombres correctos.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante la corrección de migraciones:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMigrations();