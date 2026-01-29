const express = require('express');
const router = express.Router();
const { query } = require('../db/pg');
const os = require('os');

router.get('/healthz', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'down', message: e.message });
  }
});

router.get('/server-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const infos of Object.values(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family === 'IPv4' && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  res.json({
    status: 'ok',
    hostname: os.hostname(),
    ips,
    port: Number(process.env.PORT) || 3000,
  });
});

module.exports = router;
