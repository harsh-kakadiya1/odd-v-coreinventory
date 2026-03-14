const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'CoreInventory — SMTP test',
      text: 'If you received this, SMTP is working.',
    });
    console.log('Message sent:', info.messageId || info);
  } catch (err) {
    console.error('Send failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

main();
