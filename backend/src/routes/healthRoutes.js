import express from 'express';
import mongoose from 'mongoose';
import { config } from '../config/env.js';

const router = express.Router();

router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    product: 'SafePath - Resilient Safety Relay Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      status: dbStatus,
      isMemoryDb: Boolean(config.useMemoryDb)
    },
    integrations: {
      resendEmail: {
        configured: config.resend.isConfigured,
        mode: config.resend.isConfigured ? 'live_api' : 'development_mock'
      },
      twilioSms: {
        configured: config.twilio.isConfigured,
        mode: config.twilio.isConfigured ? 'live_api' : 'development_mock'
      },
      webPush: {
        configured: config.vapid.isConfigured,
        mode: config.vapid.isConfigured ? 'live_vapid' : 'development_mock'
      },
      openRouteService: {
        configured: config.openRouteService.isConfigured,
        mode: config.openRouteService.isConfigured ? 'live_api' : 'geodesic_fallback'
      },
      openAiSummary: {
        configured: config.openAi.isConfigured,
        mode: config.openAi.isConfigured ? 'live_api' : 'deterministic_summary'
      }
    }
  });
});

export default router;
