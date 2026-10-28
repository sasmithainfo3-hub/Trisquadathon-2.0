import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/safepath',
  hasExplicitMongoUri: Boolean(process.env.MONGODB_URI),
  useMemoryDb: process.env.USE_MEMORY_DB === 'true' || !process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || 'safepath_fallback_jwt_secret_min32chars_replace_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cookieSecret: process.env.COOKIE_SECRET || 'safepath_cookie_secret_min32chars',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:dev@safepath.app',
    isConfigured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'SafePath Alerts <alerts@safepath.app>',
    isConfigured: Boolean(process.env.RESEND_API_KEY)
  },
  smtp: {
    host: process.env.SMTP_HOST || (process.env.SMTP_USER?.includes('@gmail.com') ? 'smtp.gmail.com' : ''),
    port: parseInt(process.env.SMTP_PORT || (process.env.SMTP_USER?.includes('@gmail.com') ? '465' : '587'), 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `SafePath Alerts <${process.env.SMTP_USER}>` : 'SafePath Alerts <alerts@safepath.app>'),
    isConfigured: Boolean((process.env.SMTP_HOST || process.env.SMTP_USER?.includes('@gmail.com')) && process.env.SMTP_USER && process.env.SMTP_PASS)
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    isConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
  },
  openRouteService: {
    apiKey: process.env.OPENROUTESERVICE_API_KEY || '',
    isConfigured: Boolean(process.env.OPENROUTESERVICE_API_KEY)
  },
  openAi: {
    apiKey: process.env.OPENAI_API_KEY || '',
    isConfigured: Boolean(process.env.OPENAI_API_KEY)
  }
};
