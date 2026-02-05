const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const users = require('../db/repositories/userRepository');
const userDeps = require('../db/repositories/usuarioDepositoRepository');
const licenseService = require('../services/licenseService');

const validateCreate = [
  body('nombre').trim().notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('rol_id').isInt({ gt: 0 }),
  body('activo').optional().isBoolean(),
  body('caja_tipo_default').optional().isIn(['home_office', 'sucursal']),
];

async function list(req, res) {
  try {
    const rows = await users.list({ q: req.query.q, activo: req.query.activo, limit: req.query.limit, offset: req.query.offset });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener usuarios' });
  }
}

async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const license = await licenseService.getActiveLicense();
    if (!license || !licenseService.hasFeature(license, licenseService.FEATURE_USUARIOS)) {
      return res.status(403).json({ error: 'Modulo de usuarios no habilitado' });
    }
    const activo = req.body.activo !== false;
    if (activo && license.max_users != null) {
      const maxUsers = Number(license.max_users);
      if (Number.isFinite(maxUsers) && maxUsers > 0) {
        const activeCount = await users.countActive();
        if (activeCount >= maxUsers) {
          return res.status(403).json({ error: 'Limite de usuarios alcanzado' });
        }
      }
    }
    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const hash = await bcrypt.hash(req.body.password, rounds);
    const r = await users.create({
      nombre: req.body.nombre,
      email: req.body.email,
      password_hash: hash,
      rol_id: req.body.rol_id,
      activo,
      caja_tipo_default: req.body.caja_tipo_default,
    });
    res.status(201).json({ id: r.id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
}

const validateUpdate = [
  body('nombre').optional().isString(),
  body('email').optional().isEmail(),
  body('rol_id').optional().isInt({ gt: 0 }),
  body('activo').optional().isBoolean(),
  body('password').optional().isLength({ min: 6 }),
  body('caja_tipo_default').optional().isIn(['home_office', 'sucursal']),
];

async function update(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
  try {
    const license = await licenseService.getActiveLicense();
    if (!license || !licenseService.hasFeature(license, licenseService.FEATURE_USUARIOS)) {
      return res.status(403).json({ error: 'Modulo de usuarios no habilitado' });
    }
    const fields = { ...req.body };
    delete fields.password;
    if (fields.activo === true && license.max_users != null) {
      const current = await users.findById(id);
      const wasActive = current ? current.activo !== false : false;
      const maxUsers = Number(license.max_users);
      if (!wasActive && Number.isFinite(maxUsers) && maxUsers > 0) {
        const activeCount = await users.countActive(id);
        if (activeCount >= maxUsers) {
          return res.status(403).json({ error: 'Limite de usuarios alcanzado' });
        }
      }
    }
    const r = await users.update(id, fields);
    if (!r) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (req.body.password) {
      const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
      const hash = await bcrypt.hash(req.body.password, rounds);
      await users.setPasswordHash(id, hash);
    }
    res.json({ message: 'Usuario actualizado' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
}

async function roles(req, res) {
  try {
    const rows = await users.listRoles();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener roles' });
  }
}

async function sellerPerformance(req, res) {
  try {
    const desde = req.query?.desde ? String(req.query.desde) : null;
    const hasta = req.query?.hasta ? String(req.query.hasta) : null;
    const rows = await users.sellerPerformance({ desde, hasta });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el rendimiento' });
  }
}

async function getUserDepositos(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invГЎlido' });
  }
  try {
    const rows = await userDeps.getUserDepositos(id);
    res.json(rows);
  } catch (e) {
    res
      .status(500)
      .json({ error: 'No se pudieron obtener los depГіsitos del usuario' });
  }
}

async function setUserDepositos(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'ID invГЎlido' });
  }
  const items = Array.isArray(req.body?.depositos) ? req.body.depositos : [];
  try {
    await userDeps.setUserDepositos(id, items);
    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ error: 'No se pudieron actualizar los depГіsitos del usuario' });
  }
}

module.exports = {
  list,
  create: [...validateCreate, create],
  update: [...validateUpdate, update],
  roles,
  sellerPerformance,
  getUserDepositos,
  setUserDepositos,
};
