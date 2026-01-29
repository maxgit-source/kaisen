const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categorycontroller');
const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Obtener categorías (no requiere autenticación para GET)
router.get('/categorias', categoryController.getCategorias);

// Crear categoría (requiere autenticación)
router.post('/categorias', authMiddleware, requireRole(['admin','gerente']), categoryController.createCategoria);

// Actualizar categoría (requiere autenticación)
router.put('/categorias/:id', authMiddleware, requireRole(['admin','gerente']), categoryController.updateCategoria);

// Eliminar categoría (requiere autenticación)
router.delete('/categorias/:id', authMiddleware, requireRole(['admin']), categoryController.deleteCategoria);

module.exports = router;

