const { query } = require('../db/pg');
const configRepo = require('../db/repositories/configRepository');
const syncRepo = require('../db/repositories/syncQueueRepository');

async function enqueueProduct(productId, client) {
  const q = client?.query ? client.query : query;
  const { rows } = await q(
    `SELECT p.id,
            p.categoria_id AS category_id,
            p.nombre AS name,
            p.descripcion AS description,
            p.precio_venta::float AS price,
            p.precio_local::float AS price_local,
            p.precio_distribuidor::float AS price_distribuidor,
            p.precio_final::float AS precio_final,
            c.nombre AS category_name,
            (SELECT url FROM producto_imagenes WHERE producto_id = p.id ORDER BY orden ASC, id ASC LIMIT 1) AS image_url
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = $1`,
    [productId]
  );
  if (!rows.length) return;
  await syncRepo.enqueue({
    entity: 'catalogo_producto',
    entity_id: productId,
    action: 'upsert',
    payload: rows[0],
    client,
  });
}

async function enqueueProductDelete(productId, client) {
  await syncRepo.enqueue({
    entity: 'catalogo_producto',
    entity_id: productId,
    action: 'delete',
    payload: { id: productId },
    client,
  });
}

async function enqueueCategory(categoryId, client) {
  const q = client?.query ? client.query : query;
  const { rows } = await q(
    `SELECT id, nombre AS name, imagen_url AS image_url, descripcion AS description
       FROM categorias
      WHERE id = $1`,
    [categoryId]
  );
  if (!rows.length) return;
  await syncRepo.enqueue({
    entity: 'catalogo_categoria',
    entity_id: categoryId,
    action: 'upsert',
    payload: rows[0],
    client,
  });
}

async function enqueueCategoryDelete(categoryId, client) {
  await syncRepo.enqueue({
    entity: 'catalogo_categoria',
    entity_id: categoryId,
    action: 'delete',
    payload: { id: categoryId },
    client,
  });
}

async function enqueueCatalogConfig(usuarioId) {
  const [name, logoUrl, destacadoId, publicado, priceType] = await Promise.all([
    configRepo.getTextParam('catalogo_nombre'),
    configRepo.getTextParam('catalogo_logo_url'),
    configRepo.getNumericParam('catalogo_destacado_producto_id'),
    configRepo.getNumericParam('catalogo_publicado'),
    configRepo.getTextParam('catalogo_price_type'),
  ]);
  const payload = {
    nombre: name || '',
    logo_url: logoUrl || '',
    destacado_producto_id: destacadoId != null ? Number(destacadoId) : null,
    publicado: publicado != null ? Number(publicado) === 1 : true,
    price_type: priceType || 'final',
  };
  await syncRepo.enqueue({
    entity: 'catalogo_config',
    entity_id: null,
    action: 'upsert',
    payload,
  });
}

module.exports = {
  enqueueProduct,
  enqueueProductDelete,
  enqueueCategory,
  enqueueCategoryDelete,
  enqueueCatalogConfig,
};
