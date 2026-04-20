const { sendMail } = require('../config/email');

const baseUrl = process.env.FRONTEND_URL || 'https://arkakstudio.vercel.app/login';

const emailTemplates = {
  verification: (user, token) => ({
    to: user.email,
    subject: 'Callix - Verifica tu cuenta',
    html: `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f0f4f0;padding:40px 20px;">
        <div style="background:white;border-radius:12px;padding:40px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <h1 style="color:#2d6a4f;margin:0 0 24px;">¡Bienvenido a Callix!</h1>
          <p style="color:#333;font-size:16px;line-height:1.6;">Hola <strong>${user.first_name}</strong>,</p>
          <p style="color:#555;font-size:15px;line-height:1.6;">Gracias por registrarte. Verifica tu cuenta haciendo clic en el siguiente botón:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${baseUrl}/verificar/${token}" style="background:#2d6a4f;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Verificar cuenta</a>
          </div>
          <p style="color:#888;font-size:13px;">Si no creaste esta cuenta, ignora este correo.</p>
        </div>
      </div>`,
  }),

  resetPassword: (user, token) => ({
    to: user.email,
    subject: 'Callix - Restablecer contraseña',
    html: `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f0f4f0;padding:40px 20px;">
        <div style="background:white;border-radius:12px;padding:40px;">
          <h1 style="color:#2d6a4f;margin:0 0 24px;">Restablecer contraseña</h1>
          <p style="color:#333;font-size:16px;">Hola <strong>${user.first_name}</strong>,</p>
          <p style="color:#555;font-size:15px;">Recibimos una solicitud para restablecer tu contraseña:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${baseUrl}/reset-password/${token}" style="background:#2d6a4f;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Restablecer contraseña</a>
          </div>
          <p style="color:#888;font-size:13px;">Este enlace expira en 1 hora.</p>
        </div>
      </div>`,
  }),

  appointmentConfirmClient: (client, seller, property, appointment) => ({
    to: client.email,
    subject: 'Callix - Cita confirmada',
    html: `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f0f4f0;padding:40px 20px;">
        <div style="background:white;border-radius:12px;padding:40px;">
          <h1 style="color:#2d6a4f;margin:0 0 24px;">Cita confirmada ✓</h1>
          <p style="color:#333;font-size:16px;">Hola <strong>${client.first_name}</strong>,</p>
          <p style="color:#555;">Tu cita ha sido agendada exitosamente:</p>
          <div style="background:#f0f4f0;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:4px 0;color:#333;"><strong>Propiedad:</strong> ${property.title}</p>
            <p style="margin:4px 0;color:#333;"><strong>Vendedor:</strong> ${seller.first_name} ${seller.last_name}</p>
            <p style="margin:4px 0;color:#333;"><strong>Fecha:</strong> ${appointment.appointment_date}</p>
            <p style="margin:4px 0;color:#333;"><strong>Hora:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
          </div>
          <p style="color:#888;font-size:13px;">Puedes cancelar con al menos 24 horas de anticipación.</p>
        </div>
      </div>`,
  }),

  appointmentConfirmSeller: (client, seller, property, appointment) => ({
    to: seller.email,
    subject: 'Callix - Nueva cita agendada',
    html: `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f0f4f0;padding:40px 20px;">
        <div style="background:white;border-radius:12px;padding:40px;">
          <h1 style="color:#2d6a4f;margin:0 0 24px;">Nueva cita agendada</h1>
          <p style="color:#333;font-size:16px;">Hola <strong>${seller.first_name}</strong>,</p>
          <p style="color:#555;">Un cliente ha agendado una cita contigo:</p>
          <div style="background:#f0f4f0;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:4px 0;color:#333;"><strong>Cliente:</strong> ${client.first_name} ${client.last_name}</p>
            <p style="margin:4px 0;color:#333;"><strong>Propiedad:</strong> ${property.title}</p>
            <p style="margin:4px 0;color:#333;"><strong>Fecha:</strong> ${appointment.appointment_date}</p>
            <p style="margin:4px 0;color:#333;"><strong>Hora:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
          </div>
        </div>
      </div>`,
  }),

  appointmentCancelled: (user, property, appointment, reason) => ({
    to: user.email,
    subject: 'Callix - Cita cancelada',
    html: `
      <div style="font-family:'Inter',sans-serif;max-width:600px;margin:0 auto;background:#f0f4f0;padding:40px 20px;">
        <div style="background:white;border-radius:12px;padding:40px;">
          <h1 style="color:#c0392b;margin:0 0 24px;">Cita cancelada</h1>
          <p style="color:#333;">La cita para <strong>${property.title}</strong> el ${appointment.appointment_date} a las ${appointment.start_time} ha sido cancelada.</p>
          ${reason ? `<p style="color:#555;">Motivo: ${reason}</p>` : ''}
        </div>
      </div>`,
  }),
};

module.exports = emailTemplates;
