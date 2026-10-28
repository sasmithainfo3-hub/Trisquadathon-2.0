import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

export function getSmtpTransporter() {
  const host = process.env.SMTP_HOST || (process.env.SMTP_USER?.includes('@gmail.com') ? 'smtp.gmail.com' : config.smtp?.host);
  const user = process.env.SMTP_USER || config.smtp?.user;
  const pass = process.env.SMTP_PASS || config.smtp?.pass;
  const port = parseInt(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? '465' : '587'), 10);

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

export async function sendEmail({ to, subject, html, text }) {
  // 1. Send via Resend API if configured
  if (config.resend.isConfigured) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resend.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: config.resend.fromEmail,
          to: [to],
          subject,
          html,
          text
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Resend API returned ${response.status}`);
      }

      console.log(`[SafePath Resend] Live email delivered to ${to} (ID: ${data.id})`);
      return {
        success: true,
        mode: 'resend_live',
        id: data.id
      };
    } catch (err) {
      console.error(`[SafePath Resend] Live delivery failed for ${to}:`, err.message);
    }
  }

  // 2. Send via Nodemailer SMTP if configured
  const smtpTransporter = getSmtpTransporter();
  if (smtpTransporter) {
    try {
      const fromAddress = config.smtp.from || (config.smtp.user ? `SafePath Alerts <${config.smtp.user}>` : 'SafePath Alerts <alerts@safepath.app>');
      const info = await smtpTransporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html
      });
      console.log(`[SafePath SMTP] Live email delivered via SMTP to ${to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        mode: 'smtp_live',
        id: info.messageId
      };
    } catch (err) {
      console.error(`[SafePath SMTP] Live SMTP delivery failed for ${to}:`, err.message);
    }
  }

  // 3. Fallback: Log email details and generate mailto direct link
  const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text || '')}`;
  console.log(`\n================== [SafePath Outgoing Email Notice] ==================`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Direct 1-Click Send URL: ${mailtoUrl}`);
  console.log(`Content:\n${text || html}`);
  console.log(`======================================================================\n`);

  return {
    success: true,
    mode: 'local_mock',
    mailtoUrl,
    id: `mock-email-${Date.now()}`
  };
}

export function generateContactInvitationEmail(contact, user) {
  const verifyUrl = `${config.clientUrl}/verify-contact/${contact.verificationToken}`;
  return {
    to: contact.email,
    subject: `SafePath: ${user.name} added you as a Trusted Safety Contact`,
    text: `Hello ${contact.name},\n\n${user.name} has added you as their Priority #${contact.priorityOrder} trusted safety contact on SafePath.\n\nAs a trusted contact, you will only be notified if a journey safety concern occurs or if an emergency is triggered.\n\nPlease confirm your availability by clicking this link:\n${verifyUrl}\n\nSafePath - Empowering personal safety through resilient monitoring.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">SafePath Contact Invitation</h2>
        <p>Hello <strong>${contact.name}</strong>,</p>
        <p><strong>${user.name}</strong> has added you as their <strong>Priority #${contact.priorityOrder}</strong> trusted safety contact on SafePath.</p>
        <p>If ${user.name} misses a scheduled safety check-in or triggers an emergency alert during a journey, you will receive real-time incident details and a live map link.</p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${verifyUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Trusted Contact Status</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">Or copy this link to your browser:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">SafePath is a personal safety monitoring product. SafePath does not replace municipal emergency services (911/112).</p>
      </div>
    `
  };
}

export function generateAlertEmail(alert, user, contact, trip) {
  const alertUrl = `${config.clientUrl}/respond/${alert.publicAccessToken}`;
  const isEmergency = alert.triggerReason === 'MANUAL_EMERGENCY';
  const reasonText = isEmergency
    ? 'Manual Emergency SOS Action Triggered'
    : 'Scheduled Safety Check-In Missed';

  return {
    to: contact.email,
    subject: `🚨 [URGENT SAFEPATH ALERT] Safety Concern for ${user.name}`,
    text: `URGENT SAFEPATH SAFETY ALERT\n\nUser: ${user.name}\nContact: ${contact.name} (Priority #${contact.priorityOrder})\nReason: ${reasonText}\nExplanation: ${alert.triggerExplanation}\nDestination: ${trip ? trip.destination.address : 'Not specified'}\n\nPlease click immediately to view live incident details and acknowledge that you are responding:\n${alertUrl}\n\nEscalation Notice: If unacknowledged within ${user.preferences?.defaultEscalationTimeoutMinutes || 10} minutes, SafePath will escalate to the next contact.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 2px solid #ef4444; border-radius: 8px;">
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin-bottom: 20px;">
          <h2 style="color: #991b1b; margin: 0; font-size: 20px;">🚨 SafePath Safety Alert</h2>
          <p style="color: #b91c1c; margin: 4px 0 0 0; font-weight: 600;">Action Required: Immediate Acknowledgment</p>
        </div>
        <p>Hello <strong>${contact.name}</strong>,</p>
        <p>A safety alert has been initiated for <strong>${user.name}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;">Trigger Reason:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #dc2626;">${reasonText}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;">Explanation:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155;">${alert.triggerExplanation}</td>
          </tr>
          ${trip ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;">Destination:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155;">${trip.destination.address}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;">Last Known Coordinates:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155;">${alert.lastKnownLocation.latitude.toFixed(5)}, ${alert.lastKnownLocation.longitude.toFixed(5)}</td>
          </tr>
        </table>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${alertUrl}" style="background-color: #dc2626; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">View Live Map & Acknowledge Response</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">
          <strong>Escalation Relay:</strong> If you do not acknowledge within ${user.preferences?.defaultEscalationTimeoutMinutes || 10} minutes, SafePath will escalate to the next designated trusted contact.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">SafePath never claims that an alert guarantees physical rescue or that an unacknowledged check-in proves physical danger.</p>
      </div>
    `
  };
}
