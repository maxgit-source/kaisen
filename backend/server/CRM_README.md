CRM y Postventa (Fase 2)

Migración
- Ejecutar `npm run migrate` en `backend/server` para aplicar `V2__crm_postventa.sql`.
  - Requiere haber aplicado previamente `backend/database/schema.sql` (por la funciÃ³n `trg_set_updated_at`).

Endpoints CRM
- GET `/api/crm/oportunidades` Lista con filtros: `q`, `fase`, `cliente_id`, `owner_id`, `limit`, `offset`.
- POST `/api/crm/oportunidades` Crea oportunidad.
- PUT `/api/crm/oportunidades/:id` Actualiza oportunidad.
- GET `/api/crm/actividades` Lista con filtros: `cliente_id`, `oportunidad_id`, `estado`, `limit`, `offset`.
- POST `/api/crm/actividades` Crea actividad (llamada|reunion|tarea; estado por defecto: pendiente).
- PUT `/api/crm/actividades/:id` Actualiza actividad (incluye `estado` -> completado/cancelado).

Endpoints Tickets (Postventa)
- GET `/api/tickets` Lista con filtros: `q`, `estado`, `prioridad`, `cliente_id`, `limit`, `offset`.
- POST `/api/tickets` Crea ticket.
- PUT `/api/tickets/:id` Actualiza ticket (estado, prioridad, asignación, etc.).
- GET `/api/tickets/:id/eventos` Historial de eventos.
- POST `/api/tickets/:id/eventos` Agrega evento. Para `tipo=cambio_estado` se puede enviar `detalle="nuevo_estado:<estado>"`.

Auth y roles
- Todas las rutas requieren JWT (`auth`).
- Crear/actualizar requiere rol `admin|gerente|vendedor` (ajustable en `routes/*`).

