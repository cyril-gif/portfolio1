import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter;
}

/**
 * Sends an email notification when a new contact-form message comes in.
 * Fails silently (logs only) so a broken email config never blocks the
 * form from saving to the database.
 */
export async function sendContactNotification({ name, email, subject, message }) {
  const mailer = getTransporter();
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.EMAIL_USER;

  if (!mailer || !notifyTo) {
    console.warn('⚠️  Email not configured — skipping notification (message still saved to DB).');
    return;
  }

  try {
    await mailer.sendMail({
      from: `"Portfolio Contact Form" <${process.env.EMAIL_USER}>`,
      to: notifyTo,
      replyTo: email,
      subject: `New portfolio message: ${subject}`,
      text: `You got a new message from your portfolio site.\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>New message from your portfolio</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
      `
    });
    console.log(`📧 Notification email sent to ${notifyTo}`);
  } catch (error) {
    console.error('❌ Failed to send notification email:', error.message);
  }
}
