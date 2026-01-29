const { query } = require('../pg');

function nowIso() {
  return new Date().toISOString();
}

async function enqueue({ entity, entity_id, action, payload, client }) {
  const q = client?.query ? client.query : query;
  const body = payload != null ? JSON.stringify(payload) : null;
  await q(
    `INSERT INTO sync_queue(entity, entity_id, action, payload, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $5)`,
    [entity, entity_id || null, action, body, nowIso()]
  );
}

async function listPending({ limit = 50 } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const { rows } = await query(
    `SELECT id, entity, entity_id, action, payload, status, attempts, last_error, created_at
       FROM sync_queue
      WHERE status IN ('pending', 'error')
      ORDER BY id ASC
      LIMIT $1`,
    [lim]
  );
  return rows;
}

async function markProcessing(id) {
  await query(
    `UPDATE sync_queue
        SET status = 'processing',
            updated_at = $2
      WHERE id = $1`,
    [id, nowIso()]
  );
}

async function markSent(id) {
  const ts = nowIso();
  await query(
    `UPDATE sync_queue
        SET status = 'sent',
            updated_at = $2,
            sent_at = $2
      WHERE id = $1`,
    [id, ts]
  );
}

async function markError(id, message) {
  await query(
    `UPDATE sync_queue
        SET status = 'error',
            attempts = attempts + 1,
            last_error = $2,
            updated_at = $3
      WHERE id = $1`,
    [id, message || 'sync_error', nowIso()]
  );
}

async function getStatusSummary() {
  const { rows } = await query(
    `SELECT status, COUNT(*) AS count
       FROM sync_queue
   GROUP BY status`
  );
  const summary = { pending: 0, processing: 0, sent: 0, error: 0 };
  for (const row of rows) {
    const key = String(row.status || '');
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      summary[key] = Number(row.count) || 0;
    }
  }

  const { rows: errRows } = await query(
    `SELECT id, last_error, updated_at
       FROM sync_queue
      WHERE status = 'error'
      ORDER BY updated_at DESC, id DESC
      LIMIT 5`
  );

  const { rows: sentRows } = await query(
    `SELECT sent_at
       FROM sync_queue
      WHERE status = 'sent'
        AND sent_at IS NOT NULL
      ORDER BY sent_at DESC
      LIMIT 1`
  );

  return {
    summary,
    recent_errors: errRows || [],
    last_sent_at: sentRows[0]?.sent_at || null,
  };
}

module.exports = {
  enqueue,
  listPending,
  markProcessing,
  markSent,
  markError,
  getStatusSummary,
};
