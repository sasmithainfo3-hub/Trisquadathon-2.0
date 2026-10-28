import { AuditLog } from '../models/AuditLog.js';

export async function recordAuditLog({ userId, action, resourceType, resourceId, req, details = {} }) {
  try {
    const ipAddress = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown';
    const userAgent = req?.headers?.['user-agent'] || 'unknown';

    // Sanitize details to never store passwords or secrets
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.jwt;
    delete sanitizedDetails.secret;

    await AuditLog.create({
      userId: userId || null,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      ipAddress,
      userAgent,
      details: sanitizedDetails
    });
  } catch (err) {
    console.error('[SafePath Audit] Failed to write audit log:', err.message);
  }
}
