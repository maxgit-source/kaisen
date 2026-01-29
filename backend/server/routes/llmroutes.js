const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/llmcontroller');
const auth = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.post(
  '/ai/crm-suggestion',
  auth,
  requireRole(['admin', 'gerente', 'vendedor']),
  ctrl.crmSuggestion
);

router.post(
  '/ai/ticket-reply',
  auth,
  requireRole(['admin', 'gerente', 'vendedor']),
  ctrl.ticketReply
);

router.post(
  '/ai/explain-forecast',
  auth,
  requireRole(['admin', 'gerente']),
  ctrl.explainForecast
);

module.exports = router;
