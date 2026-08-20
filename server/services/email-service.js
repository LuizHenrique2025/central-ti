const nodemailer = require('nodemailer');

function createEmailService(config) {
  const transporter = config.SMTP_ENABLED
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
      })
    : null;

  async function sendVerificationCode(user, code) {
    if (!transporter) throw new Error('Validação por e-mail não está configurada no servidor.');
    await transporter.sendMail({
      from: config.MAIL_FROM || config.SMTP_USER,
      to: user.email,
      subject: 'Código de acesso · Central TI',
      text: `Seu código de acesso à Central TI é ${code}. Ele expira em 10 minutos. Se você não tentou entrar, ignore esta mensagem.`,
      html: `<div style="font-family:Arial,sans-serif;color:#14202d"><h2>Central TI</h2><p>Use este código para concluir seu acesso:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px">${code}</p><p>O código expira em 10 minutos. Se você não tentou entrar, ignore esta mensagem.</p></div>`
    });
  }

  return { enabled: Boolean(transporter), sendVerificationCode };
}

module.exports = { createEmailService };
