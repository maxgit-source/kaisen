const { check, validationResult } = require('express-validator');
const repo = require('../db/repositories/productRepository');

async function getProducts(req, res) {
  try {
    const { category_id, page, limit, sort, dir, all } = req.query || {};
    const rawSearch = (req.query.search || req.query.q || '').toString().trim();
    const q = rawSearch || undefined;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const allowAll = String(all || '') === '1';
    const maxLimit = allowAll ? 10000 : 200;
    const defaultLimit = allowAll ? maxLimit : 50;
    const perPage = Math.min(Math.max(parseInt(limit, 10) || defaultLimit, 1), maxLimit);
    const { rows, total } = await repo.listProductsPaginated({
      q,
      categoryId: category_id,
      page: pageNum,
      limit: perPage,
      sort,
      dir,
      allowAll,
    });
    // Ensure response shape compatibility (add missing keys if needed)
    const mapped = rows.map((r) => ({
      id: r.id,
      category_id: r.category_id,
      name: r.name,
      codigo: r.codigo,
      description: r.description,
      price: r.price,
      image_url: r.image_url || null,
      category_name: r.category_name,
      stock_quantity: r.stock_quantity,
      // Extended pricing fields (optional for compatibility)
      costo_pesos: r.costo_pesos,
      costo_dolares: r.costo_dolares,
      tipo_cambio: r.tipo_cambio,
      margen_local: r.margen_local,
      margen_distribuidor: r.margen_distribuidor,
      price_local: r.price_local,
      price_distribuidor: r.price_distribuidor,
      precio_final: r.precio_final,
      marca: r.marca,
      modelo: r.modelo,
      procesador: r.procesador,
      ram_gb: r.ram_gb,
      almacenamiento_gb: r.almacenamiento_gb,
      pantalla_pulgadas: r.pantalla_pulgadas,
      camara_mp: r.camara_mp,
      bateria_mah: r.bateria_mah,
      created_at: r.created_at,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at || null,
    }));
    const totalPages = perPage > 0 ? Math.max(1, Math.ceil((total || 0) / perPage)) : 1;
    res.json({ data: mapped, total, page: pageNum, totalPages });
  } catch (err) {
    console.error('Error en getProducts:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// Validation (payload en inglés para compatibilidad)
const validateProduct = [
  check('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 chars'),
  check('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be at most 500 chars'),
  check('price')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
  check('codigo')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('codigo must be 3-50 chars')
    .isString().withMessage('codigo must be a string'),
  check('image_url')
    .trim()
    .notEmpty().withMessage('Image URL is required')
    .isString().withMessage('Image URL must be a string'),
  check('category_id')
    .notEmpty().withMessage('category_id is required')
    .isInt({ min: 1 }).withMessage('category_id must be an integer >= 1'),
  check('stock_quantity')
    .optional()
    .isInt({ min: 0 }).withMessage('stock_quantity must be an integer >= 0'),
  check('specifications')
    .optional()
    .isString().withMessage('specifications must be a string'),
  check('precio_costo_pesos')
    .optional()
    .isFloat({ min: 0 }).withMessage('precio_costo_pesos must be a positive number or zero'),
  check('precio_costo_dolares')
    .optional()
    .isFloat({ min: 0 }).withMessage('precio_costo_dolares must be a positive number or zero'),
  check('tipo_cambio')
    .optional({ nullable: true })
    .isFloat({ gt: 0 }).withMessage('tipo_cambio must be > 0'),
  check('margen_local')
    .optional()
    .isFloat({ min: 0 }).withMessage('margen_local must be >= 0'),
  check('margen_distribuidor')
    .optional()
    .isFloat({ min: 0 }).withMessage('margen_distribuidor must be >= 0'),
  check('proveedor_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('proveedor_id must be an integer >= 1'),
  check('precio_final')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Precio final debe ser un número positivo'),
  check('marca').optional().isString().isLength({ max: 120 }),
  check('modelo').optional().isString().isLength({ max: 120 }),
  check('procesador').optional().isString().isLength({ max: 120 }),
  check('ram_gb').optional().isInt({ min: 0 }),
  check('almacenamiento_gb').optional().isInt({ min: 0 }),
  check('pantalla_pulgadas').optional().isFloat({ min: 0 }),
  check('camara_mp').optional().isInt({ min: 0 }),
  check('bateria_mah').optional().isInt({ min: 0 }),
];

async function createProduct(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('ValidaciÃ³n fallida en createProduct:', errors.array(), { body: req.body });
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    description,
    price,
    codigo,
    image_url,
    category_id,
    stock_quantity,
    precio_costo_pesos,
    precio_costo_dolares,
    tipo_cambio,
    margen_local,
    margen_distribuidor,
    proveedor_id,
    precio_final,
    marca,
    modelo,
    procesador,
    ram_gb,
    almacenamiento_gb,
    pantalla_pulgadas,
    camara_mp,
    bateria_mah,
  } = req.body;

  try {
    const result = await repo.createProduct({
      name,
      description,
      price,
      codigo,
      image_url,
      category_id: Number(category_id),
      stock_quantity,
      precio_costo_pesos,
      precio_costo_dolares,
      tipo_cambio,
      margen_local,
      margen_distribuidor,
      proveedor_id,
      precio_final,
      marca,
      modelo,
      procesador,
      ram_gb,
      almacenamiento_gb,
      pantalla_pulgadas,
      camara_mp,
      bateria_mah,
    });
    res.status(201).json({ id: result.id });
  } catch (err) {
    const code = err.status || 500;
    if (code === 400) {
      console.error('Bad request creating product:', err.message, { body: req.body });
      return res.status(400).json({ error: err.message });
    }
    console.error('Error creating product:', err, { body: req.body });
    res.status(500).json({ error: 'Failed to create product' });
  }
}

async function updateProduct(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('ValidaciÃ³n fallida en updateProduct:', errors.array(), { body: req.body });
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const {
    name,
    description,
    price,
    codigo,
    image_url,
    category_id,
    stock_quantity,
    precio_costo_pesos,
    precio_costo_dolares,
    tipo_cambio,
    margen_local,
    margen_distribuidor,
    proveedor_id,
    precio_final,
    marca,
    modelo,
    procesador,
    ram_gb,
    almacenamiento_gb,
    pantalla_pulgadas,
    camara_mp,
    bateria_mah,
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Product ID required for update' });
  }

  try {
    await repo.updateProduct(Number(id), {
      name,
      description,
      price,
      codigo,
      image_url,
      category_id: Number(category_id),
      stock_quantity,
      precio_costo_pesos,
      precio_costo_dolares,
      tipo_cambio,
      margen_local,
      margen_distribuidor,
      proveedor_id,
      precio_final,
      marca,
      modelo,
      procesador,
      ram_gb,
      almacenamiento_gb,
      pantalla_pulgadas,
      camara_mp,
      bateria_mah,
    });
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    const code = err.status || 500;
    if (code === 400) {
      console.error('Bad request updating product:', err.message, { body: req.body });
      return res.status(400).json({ error: err.message });
    }
    console.error('Error updating product:', err, { body: req.body });
    res.status(500).json({ error: 'Failed to update product' });
  }
}

async function deleteProduct(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Product ID required' });
  }

  try {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    await repo.deactivateProduct(idNum);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}

async function getProductHistory(req, res) {
  const { id } = req.params;
  const { limit, offset } = req.query || {};

  const productId = Number(id);
  if (!productId || !Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const rows = await repo.getProductHistory(productId, { limit, offset });
    res.json(rows);
  } catch (err) {
    console.error('Error fetching product history:', err);
    res.status(500).json({ error: 'Failed to fetch product history' });
  }
}

async function getProductByCodigo(req, res) {
  const codigo = String(req.params.codigo || '').trim();
  if (!codigo) {
    return res.status(400).json({ error: 'codigo requerido' });
  }
  try {
    const row = await repo.findByCodigo(codigo);
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(row);
  } catch (err) {
    console.error('Error fetching product by codigo:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

module.exports = {
  getProducts,
  createProduct: [...validateProduct, createProduct],
  updateProduct: [...validateProduct, updateProduct],
  deleteProduct,
  getProductHistory,
  getProductByCodigo,
};
