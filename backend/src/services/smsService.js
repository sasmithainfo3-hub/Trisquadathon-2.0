import { config } from '../config/env.js';

export async function sendSms({ to, message }) {
  if (!config.twilio.isConfigured) {
    console.log(`\n================== [SafePath Twilio MOCK SMS] ==================`);
    console.log(`To: ${to}`);
    console.log(`From: ${config.twilio.phoneNumber || 'SafePath'}`);
    console.log(`Message: ${message}`);
    console.log(`=================================================================\n`);
    return {
      success: true,
      mode: 'local_mock',
      sid: `mock-sms-${Date.now()}`
    };
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: to,
      From: config.twilio.phoneNumber,
      Body: message
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Twilio error ${response.status}`);
    }

    return {
      success: true,
      mode: 'twilio_live',
      sid: data.sid
    };
  } catch (err) {
    console.error(`[SafePath Twilio] Failed to send SMS to ${to}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
