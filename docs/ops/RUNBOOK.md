# Kaisen ERP — Runbook de Operaciones

Guía técnica para instalación, mantenimiento y resolución de problemas en producción.

---

## 1. INSTALACIÓN NUEVA

### Requisitos del servidor
- Ubuntu 22.04 / Debian 12 (recomendado)
- RAM: mínimo 2 GB (4 GB recomendado)
- Disco: mínimo 20 GB SSD
- Docker + Docker Compose v2
- Git

### Proceso completo (< 15 minutos)

```bash
# 1. Clonar el repositorio
git clone <url-del-repo> kaisen && cd kaisen

# 2. Dar permisos de ejecución
chmod +x install.sh update.sh backup.sh

# 3. Ejecutar el instalador interactivo
./install.sh
# → Pregunta: nombre de empresa, email admin, contraseña, puerto, licencia

# 4. Verificar que el sistema levantó
curl http://localhost/api/readyz
# Debe responder: {"status":"ok","checks":{"db":"ok",...}}

# 5. Acceder al sistema
# http://IP_DEL_SERVIDOR o https://tu-dominio.com
```

---

## 2. ACTUALIZACIÓN DE VERSIÓN

```bash
# Desde el directorio del proyecto
./update.sh

# El script automáticamente:
# 1. Hace backup de la base de datos
# 2. Descarga el código nuevo (git pull)
# 3. Reconstruye las imágenes Docker
# 4. Aplica migraciones de base de datos
# 5. Reinicia los servicios
# 6. Verifica que el sistema responde

# Para saltear el backup previo (no recomendado):
./update.sh --skip-backup
```

---

## 3. BACKUPS

### Backup manual
```bash
./backup.sh
# Guarda en ./backups/kaisen_YYYYMMDD_HHMMSS.sql.gz
# Retiene los últimos 30 backups automáticamente
```

### Backup en S3 (producción)
```bash
# Configurar en .env:
BACKUP_BUCKET_URI=s3://mi-bucket/kaisen-backups
BACKUP_PREFIX=cliente-garcia

# Ejecutar:
bash backend/server/scripts/backup-mysql.sh
```

### Restaurar desde backup
```bash
# 1. Identificar el backup a restaurar
ls -lh ./backups/

# 2. Restaurar (detiene el backend durante la restauración)
docker compose -f docker-compose.prod.yml stop backend
docker compose -f docker-compose.prod.yml exec -T db \
  mysql -uroot -p${MYSQL_ROOT_PASSWORD} kaisen_prod < backup_20250101.sql
docker compose -f docker-compose.prod.yml start backend
```

---

## 4. COMANDOS DE DIAGNÓSTICO

### Ver estado de servicios
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml stats
```

### Ver logs en tiempo real
```bash
# Backend
docker compose -f docker-compose.prod.yml logs -f backend

# Base de datos
docker compose -f docker-compose.prod.yml logs -f db

# Todos los servicios
docker compose -f docker-compose.prod.yml logs -f
```

### Health check manual
```bash
curl http://localhost:3000/api/readyz | jq .
# Respuesta esperada:
# {
#   "status": "ok",
#   "db": "connected",
#   "redis": "connected",
#   "uptime": 3600
# }
```

### Acceder a la base de datos
```bash
docker compose -f docker-compose.prod.yml exec db \
  mysql -uroot -p${MYSQL_ROOT_PASSWORD} kaisen_prod
```

### Ejecutar migraciones manualmente
```bash
docker compose -f docker-compose.prod.yml exec backend node scripts/migrate.js
```

---

## 5. GESTIÓN DE USUARIOS

### Crear administrador
```bash
docker compose -f docker-compose.prod.yml exec backend \
  node scripts/bootstrap-admin.js admin@empresa.com NuevaPass123 "Nombre Admin"
```

### Cambiar contraseña de admin
```bash
docker compose -f docker-compose.prod.yml exec backend \
  node scripts/set-admin-password.js admin@empresa.com NuevaPass456
```

---

## 6. GESTIÓN DE LICENCIAS

### Generar licencia para nuevo cliente
```bash
# En el entorno del desarrollador (necesita LICENSE_MASTER_KEY)
node backend/server/scripts/generate-license.js \
  --client "cliente-001" \
  --company "Almacén García" \
  --modules basico,whatsapp,ia \
  --expires 2027-01-01

# Output: KAISEN-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Agregar al .env del cliente: LICENSE_KEY=KAISEN-xxx...
```

### Verificar licencia activa
```bash
curl http://localhost:3000/api/readyz | jq '.license'
```

---

## 7. VARIABLES DE ENTORNO CRÍTICAS

| Variable | Obligatoria | Descripción |
|---|---|---|
| `JWT_SECRET` | ✅ | Secreto para firmar tokens JWT (mínimo 32 chars) |
| `REFRESH_TOKEN_SECRET` | ✅ | Secreto para refresh tokens |
| `MYSQL_PASSWORD` | ✅ | Contraseña de la base de datos |
| `MYSQL_ROOT_PASSWORD` | ✅ | Contraseña root de MySQL |
| `LICENSE_KEY` | ✅ en prod | Clave de licencia del cliente |
| `REDIS_URL` | Recomendada | URL de Redis (fallback a memoria si no está) |
| `SENTRY_DSN` | Recomendada | DSN de Sentry para error tracking |
| `WHATSAPP_ENABLED` | Opcional | Habilitar WhatsApp (`true`/`false`) |
| `OWNER_PHONE_E164` | Opcional | Teléfono del dueño para alertas (E.164: +5491155551234) |

### Rotar secrets JWT (sin downtime)
```bash
# 1. Agregar nuevo secret como JWT_SECRET_NEW en .env
# 2. Reiniciar backend (todos los tokens existentes se invalidan)
# 3. Usuarios deben volver a iniciar sesión
# Aviso: notificar a los usuarios antes de rotar
```

---

## 8. PROBLEMAS FRECUENTES

### "La base de datos no responde"
```bash
# 1. Verificar que el contenedor está corriendo
docker compose -f docker-compose.prod.yml ps db

# 2. Si está detenido, reiniciarlo
docker compose -f docker-compose.prod.yml start db

# 3. Ver logs para la causa
docker compose -f docker-compose.prod.yml logs --tail=50 db

# 4. Verificar espacio en disco
df -h
```

### "El sistema es lento"
```bash
# 1. Ver consumo de recursos
docker compose -f docker-compose.prod.yml stats

# 2. Ver queries lentas en MySQL (sesión activa)
docker compose -f docker-compose.prod.yml exec db \
  mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "SHOW PROCESSLIST;" kaisen_prod

# 3. Ver índices faltantes
docker compose -f docker-compose.prod.yml exec db \
  mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e \
  "SELECT * FROM information_schema.TABLE_STATISTICS ORDER BY rows_read DESC LIMIT 20;" \
  kaisen_prod
```

### "WhatsApp no se conecta"
```bash
# 1. Ver logs del backend
docker compose -f docker-compose.prod.yml logs --tail=100 backend | grep -i whatsapp

# 2. Verificar estado vía API
curl http://localhost:3000/api/whatsapp/status

# 3. Forzar reconexión
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Authorization: Bearer <token-admin>"
```

### "No llegan alertas por WhatsApp"
1. Verificar que `WHATSAPP_ENABLED=true` en `.env`
2. Verificar que `OWNER_PHONE_E164` tiene formato correcto (`+5491155551234`)
3. Verificar que WhatsApp esté conectado (ver punto anterior)
4. Revisar rate limit: máximo 20 mensajes/hora

### "Error de licencia al iniciar"
```bash
# Ver el error exacto
docker compose -f docker-compose.prod.yml logs backend | grep -i licencia

# Regenerar y configurar licencia
node backend/server/scripts/generate-license.js --help
# Agregar LICENSE_KEY=<nueva-clave> al .env
# Reiniciar backend
docker compose -f docker-compose.prod.yml restart backend
```

---

## 9. MONITOREO DE PRODUCCIÓN

### UptimeRobot (gratuito)
1. Crear cuenta en uptimerobot.com
2. Agregar monitor tipo HTTP(S)
3. URL: `https://tu-dominio.com/api/readyz`
4. Intervalo: cada 5 minutos
5. Alertas: email + WhatsApp (si disponible)

### Sentry (error tracking)
1. Crear proyecto en sentry.io
2. Obtener DSN
3. Agregar `SENTRY_DSN=<dsn>` al `.env`
4. `VITE_SENTRY_DSN=<dsn>` al frontend `.env`
5. Reiniciar servicios

---

## 10. CHECKLIST DE PRODUCCIÓN

Verificar antes de entregar el sistema al cliente:

- [ ] `NODE_ENV=production` en `.env`
- [ ] `JWT_SECRET` y `REFRESH_TOKEN_SECRET` son strings aleatorios de 32+ chars
- [ ] `LICENSE_KEY` configurado y válido
- [ ] Backup automático configurado (cron o GitHub Actions)
- [ ] UptimeRobot configurado
- [ ] HTTPS habilitado (si hay dominio)
- [ ] `SENTRY_DSN` configurado (opcional pero muy recomendado)
- [ ] `OWNER_PHONE_E164` configurado para alertas
- [ ] Primer login con contraseña nueva (cambiar la del instalador)
- [ ] Wizard de onboarding completado (nombre empresa, logo)
- [ ] Test de backup: ejecutar `./backup.sh` y verificar que crea el archivo
