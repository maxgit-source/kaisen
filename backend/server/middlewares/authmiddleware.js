const jwt = require('jsonwebtoken');

// Claves y parametros JWT, desde variables de entorno
const SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const JWT_ALG = process.env.JWT_ALG || 'HS256';

// Lista negra de tokens JWT invalidados (en memoria, para produccion real usar DB o Redis)
const tokenBlacklist = new Set();

/**
 * Middleware para verificar el token JWT de acceso.
 * Extrae el token del encabezado 'Authorization', lo verifica y adjunta la informacion del usuario a la solicitud.
 * Tambien verifica si el token esta en la lista negra.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 * @param {function} next - Funcion para pasar el control al siguiente middleware.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extraer el token del encabezado 'Bearer <token>'

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  // Verificar que la clave secreta de JWT este definida
  if (!SECRET) {
    console.error('Error: La variable de entorno JWT_SECRET no esta definida para la verificacion del token.');
    return res.status(500).json({ error: 'Configuracion del servidor incompleta.' });
  }

  // Verificar si el token esta en la lista negra
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token invalido o revocado' });
  }

  try {
    const verifyOptions = { algorithms: [JWT_ALG] };
    if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;
    const user = jwt.verify(token, SECRET, verifyOptions); // Verificar el token con restricciones
    if (user && user.role === 'cliente') {
      return res.status(403).json({ error: 'Token de cliente no autorizado' });
    }
    req.user = user; // Adjuntar info del usuario a la solicitud
    req.token = token; // Adjuntar el token actual para posible invalidacion
    next(); // Continuar con la siguiente funcion de middleware o ruta
  } catch (err) {
    console.error('Error de verificacion de token:', err.message);
    // 401 permite que el frontend intente refrescar el access token con el refresh token
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

/**
 * Agrega un token a la lista negra.
 * @param {string} token - El token JWT a invalidar.
 */
function addTokenToBlacklist(token) {
  tokenBlacklist.add(token);
  // En produccion real se deberia persistir en un store externo y limpiar tras su expiracion original.
}

module.exports = authMiddleware;
module.exports.addTokenToBlacklist = addTokenToBlacklist;
module.exports.SECRET = SECRET;
module.exports.REFRESH_SECRET = REFRESH_SECRET;
