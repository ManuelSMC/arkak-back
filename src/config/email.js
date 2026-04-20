const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[EMAIL-DEV] To: ${to} | Subject: ${subject}`);
    return;
  }
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Callix <noreply@arkak.com>',
    to,
    subject,
    html,
  });
};

module.exports = { sendMail };
