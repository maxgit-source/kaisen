const { check, validationResult } = require('express-validator');
const repo = require('../db/repositories/categoryRepository');

// Obtener categorías (mapeo a shape existente)
async function getCategorias(req, res) {
  try {
    const rows = await repo.getAllActive();
    res.json(rows);
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de la categoría ya existe' });
    }
    console.error('Error al obtener categorías:', err);
    res.status(500).json({ error: 'No se pudo obtener categorías' });
  }
}

// Reglas de validación
const validateCategory = [
  check('name')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  check('image_url')
    .trim()
    .notEmpty().withMessage('La imagen es obligatoria'),
  check('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('La descripción es demasiado larga')
];

// Validación de actualización (campos opcionales)
const validateCategoryUpdate = [
  check('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  check('image_url')
    .optional()
    .trim(),
  check('description')
    .optional()
    .isLength({ max: 2000 }).withMessage('La descripción es demasiado larga')
];

// Crear categoría (o restaurar si estaba inactiva)
async function createCategoria(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validación fallida en createCategoria:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, image_url, description } = req.body;

  try {
    const normName = String(name || '').trim();
    const imgUrlVal = String(image_url || '').trim() || null;
    const result = await repo.restoreOrInsert({ name: normName, image_url: imgUrlVal, description });
    if (result.restored) return res.status(200).json({ id: result.id, restored: true });
    return res.status(201).json({ id: result.id });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de la categoría ya existe' });
    }
    console.error('Error al crear categoría:', err);
    res.status(500).json({ error: 'No se pudo crear la categoría' });
  }
}

// Actualizar categoría
async function updateCategoria(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('Validación fallida en updateCategoria:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, image_url, description } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'ID de la categoría requerido para actualizar' });
  }

  try {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const updated = await repo.updateCategory(idNum, { name, image_url, description });
    if (!updated) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría actualizada correctamente' });
  } catch (err) {
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de la categoría ya existe' });
    }
    console.error('Error al actualizar categoría:', err);
    res.status(500).json({ error: 'No se pudo actualizar la categoría' });
  }
}

// Eliminar (desactivar) categoría y sus productos
async function deleteCategoria(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID de la categoría requerido' });
  }

  try {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await repo.deactivateCascade(idNum);
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Categoría no encontrada' });
    console.error('Error al eliminar categoría:', err);
    res.status(500).json({ error: 'No se pudo eliminar la categoría' });
  }
}

module.exports = {
  getCategorias,
  createCategoria: [...validateCategory, createCategoria],
  updateCategoria: [...validateCategoryUpdate, updateCategoria],
  deleteCategoria,
};

