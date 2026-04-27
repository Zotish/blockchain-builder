/**
 * ChainForge — Email Service
 *
 * Sends transactional emails via SMTP (works with Gmail, Resend, Mailgun, SendGrid).
 * Configure using SMTP_* environment variables in Railway.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Support multiple providers via env vars
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

const FROM = `"ChainForge" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@chainforge.app'}>`;
const APP_URL = process.env.FRONTEND_URL || 'https://chainforge.netlify.app';

// ── Email templates ──────────────────────────────────────

function emailVerificationTemplate(username, verifyUrl) {
  return {
    subject: '✅ Verify your ChainForge email',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#e2e8f0;padding:32px;border-radius:12px">
        <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
          ⛓️ ChainForge
        </h1>
        <h2 style="color:#fff">Welcome, ${username}!</h2>
        <p>Please verify your email address to start building blockchains.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;border-radius:8px;font-weight:700;margin:20px 0">
          Verify Email →
        </a>
        <p style="color:#94a3b8;font-size:13px">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>
    `,
    text: `Welcome to ChainForge, ${username}!\n\nVerify your email: ${verifyUrl}\n\nExpires in 24 hours.`,
  };
}

function passwordResetTemplate(username, resetUrl) {
  return {
    subject: '🔑 Reset your ChainForge password',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#e2e8f0;padding:32px;border-radius:12px">
        <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
          ⛓️ ChainForge
        </h1>
        <h2 style="color:#fff">Password Reset</h2>
        <p>Hi ${username}, you requested a password reset.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;border-radius:8px;font-weight:700;margin:20px 0">
          Reset Password →
        </a>
        <p style="color:#94a3b8;font-size:13px">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
    text: `Reset your ChainForge password: ${resetUrl}\n\nExpires in 1 hour.`,
  };
}

function deploymentSuccessTemplate(username, chainName, endpoints) {
  return {
    subject: `🚀 Your blockchain "${chainName}" is live!`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a1a;color:#e2e8f0;padding:32px;border-radius:12px">
        <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
          ⛓️ ChainForge
        </h1>
        <h2 style="color:#10b981">🎉 "${chainName}" is live!</h2>
        <p>Hi ${username}, your blockchain is successfully deployed.</p>
        <div style="background:#1e1e3a;border-radius:8px;padding:16px;margin:16px 0">
          <p style="color:#94a3b8;margin:0 0 8px;font-size:12px;text-transform:uppercase">RPC Endpoint</p>
          <code style="color:#6366f1">${endpoints.rpc}</code>
          <p style="color:#94a3b8;margin:16px 0 8px;font-size:12px;text-transform:uppercase">WebSocket</p>
          <code style="color:#6366f1">${endpoints.ws}</code>
        </div>
        <a href="${APP_URL}/dashboard"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;border-radius:8px;font-weight:700">
          View Dashboard →
        </a>
      </div>
    `,
    text: `Your blockchain "${chainName}" is live!\nRPC: ${endpoints.rpc}\nWS: ${endpoints.ws}`,
  };
}

// ── Send functions ────────────────────────────────────────

async function sendEmail(to, template) {
  if (!process.env.SMTP_USER) {
    console.log(`📧 [Email skipped — SMTP not configured] To: ${to} | Subject: ${template.subject}`);
    return;
  }

  try {
    await getTransporter().sendMail({ from: FROM, to, ...template });
    console.log(`📧 Email sent to ${to}: ${template.subject}`);
  } catch (err) {
    console.error(`❌ Email send failed to ${to}:`, err.message);
    // Don't throw — email failure shouldn't break the request
  }
}

async function sendVerificationEmail(user, token) {
  const url = `${APP_URL}/auth/verify?token=${token}`;
  await sendEmail(user.email, emailVerificationTemplate(user.username, url));
}

async function sendPasswordResetEmail(user, token) {
  const url = `${APP_URL}/auth/reset-password?token=${token}`;
  await sendEmail(user.email, passwordResetTemplate(user.username, url));
}

async function sendDeploymentSuccessEmail(user, chainName, endpoints) {
  await sendEmail(user.email, deploymentSuccessTemplate(user.username, chainName, endpoints));
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendDeploymentSuccessEmail,
};
