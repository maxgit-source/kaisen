const { query, withTransaction } = require('../../db/pg');
const catalogSync = require('../../services/catalogSyncService');

async function getAllActive() {
  const { rows } = await query(
    `SELECT id,
            nombre AS name,
            imagen_url AS image_url,
            descripcion AS description
       FROM categorias
      WHERE activo = TRUE
      ORDER BY nombre ASC`
  );
  return rows;
}

async function findByName(name) {
  const { rows } = await query(
    'SELECT id, nombre, activo FROM categorias WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
    [name]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    'SELECT id, nombre, activo FROM categorias WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function restoreOrInsert({ name, image_url, description }) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT id, activo FROM categorias WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
      [name]
    );
    if (existing.rowCount) {
      const row = existing.rows[0];
      if (!row.activo) {
        const upd = await client.query(
          `UPDATE categorias
              SET imagen_url = $1,
                  descripcion = $2,
                  activo = TRUE
            WHERE id = $3
            RETURNING id`,
          [image_url || null, description || null, row.id]
        );
        await catalogSync.enqueueCategory(upd.rows[0].id, client);
        return { id: upd.rows[0].id, restored: true };
      } else {
        const err = new Error('El nombre de la categoria ya existe');
        err.code = '23505';
        throw err;
      }
    }
    const ins = await client.query(
      `INSERT INTO categorias(nombre, imagen_url, descripcion)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, image_url || null, description || null]
    );
    await catalogSync.enqueueCategory(ins.rows[0].id, client);
    return { id: ins.rows[0].id, restored: false };
  });
}

async function updateCategory(id, { name, image_url, description }) {
  const sets = [];
  const params = [];
  let p = 1;
  if (typeof name !== 'undefined') { sets.push(`nombre = $${p++}`); params.push(name); }
  if (typeof description !== 'undefined') { sets.push(`descripcion = $${p++}`); params.push(description || null); }
  if (typeof image_url !== 'undefined') { sets.push(`imagen_url = $${p++}`); params.push(image_url || null); }
  if (!sets.length) return { id };
  const sql = `UPDATE categorias SET ${sets.join(', ')} WHERE id = $${p} RETURNING id`;
  params.push(id);
  const result = await query(sql, params);
  if (result.rows[0]?.id) {
    await catalogSync.enqueueCategory(result.rows[0].id);
  }
  return result.rows[0] || null;
}

async function deactivateCascade(id) {
  return withTransaction(async (client) => {
    await client.query('UPDATE productos SET activo = FALSE WHERE categoria_id = $1 AND activo = TRUE', [id]);
    const result = await client.query('UPDATE categorias SET activo = FALSE WHERE id = $1 AND activo = TRUE', [id]);
    if (!result.rowCount) {
      const e = new Error('Categoria no encontrada');
      e.status = 404;
      throw e;
    }
    const { rows } = await client.query('SELECT id FROM productos WHERE categoria_id = $1', [id]);
    for (const row of rows) {
      await catalogSync.enqueueProductDelete(Number(row.id), client);
    }
    await catalogSync.enqueueCategoryDelete(id, client);
  });
}

module.exports = {
  getAllActive,
  findByName,
  findById,
  restoreOrInsert,
  updateCategory,
  deactivateCascade,
};
